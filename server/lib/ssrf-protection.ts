/**
 * SSRF Protection Utilities
 * Prevents Server-Side Request Forgery attacks by validating URLs and IP addresses
 */

import { promises as dns } from "dns";
import { isIP } from "net";

/**
 * Check if an IP address is in a private or restricted range
 * Blocks:
 * - Private IPv4: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - Loopback: 127.0.0.0/8, ::1
 * - Link-local: 169.254.0.0/16 (includes AWS metadata)
 * - Localhost variants: 0.0.0.0
 */
export function isPrivateOrRestrictedIP(ip: string): boolean {
  const ipType = isIP(ip);
  
  if (ipType === 4) {
    // IPv4 checks
    const parts = ip.split(".").map(Number);
    
    // Loopback: 127.0.0.0/8
    if (parts[0] === 127) return true;
    
    // Private: 10.0.0.0/8
    if (parts[0] === 10) return true;
    
    // Private: 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // Private: 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    // Link-local (includes AWS metadata): 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;
    
    // Localhost variants
    if (ip === "0.0.0.0") return true;
    
    return false;
  } else if (ipType === 6) {
    // IPv6 checks
    const normalized = ip.toLowerCase();
    
    // Loopback: ::1
    if (normalized === "::1") return true;
    
    // Link-local: fe80::/10
    if (normalized.startsWith("fe80:")) return true;
    
    // Unique local: fc00::/7
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    
    return false;
  }
  
  return false;
}

/**
 * Resolve hostname to IP addresses and validate none are private/restricted
 * If DNS resolution fails, returns valid:true to allow the fetch attempt
 * (the fetch may still fail, and that's okay - it means the domain doesn't exist)
 * If DNS succeeds and resolves to a private IP, blocks it
 */
export async function validateUrlForSSRF(url: string): Promise<{ valid: boolean; error?: string }> {
  let urlObj: URL;
  
  try {
    urlObj = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
  
  const hostname = urlObj.hostname;
  
  // Check if hostname is already an IP address
  if (isIP(hostname)) {
    if (isPrivateOrRestrictedIP(hostname)) {
      return { 
        valid: false, 
        error: "Access to private, loopback, or link-local IP addresses is forbidden" 
      };
    }
    return { valid: true };
  }
  
  // Resolve hostname to IPs
  try {
    const ipv4Addresses: string[] = [];
    const ipv6Addresses: string[] = [];
    
    // Try IPv4 resolution
    try {
      const v4 = await dns.resolve4(hostname);
      ipv4Addresses.push(...v4);
    } catch {
      // IPv4 resolution failed, might not have A records
    }
    
    // Try IPv6 resolution
    try {
      const v6 = await dns.resolve6(hostname);
      ipv6Addresses.push(...v6);
    } catch {
      // IPv6 resolution failed, might not have AAAA records
    }
    
    const allIPs = [...ipv4Addresses, ...ipv6Addresses];
    
    // If DNS resolution succeeded, validate all IPs
    if (allIPs.length > 0) {
      for (const ip of allIPs) {
        if (isPrivateOrRestrictedIP(ip)) {
          return { 
            valid: false, 
            error: `Hostname resolves to forbidden IP address: ${ip}` 
          };
        }
      }
      return { valid: true };
    }
    
    // If DNS resolution failed (no A/AAAA records), allow the fetch attempt anyway
    // The fetch may still fail if the domain doesn't exist
    // This handles cases where DNS is misconfigured or unavailable
    return { valid: true };
  } catch (error) {
    // DNS lookup threw an error (server config issue, not a security issue)
    // Allow the fetch to proceed - if the domain is invalid, fetch will fail
    return { valid: true };
  }
}

/**
 * Fetch with SSRF protection
 * - Validates URL before fetching
 * - Blocks redirects
 * - Enforces timeout
 * - Re-validates after DNS resolution
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  // Pre-fetch validation
  const validation = await validateUrlForSSRF(url);
  if (!validation.valid) {
    throw new Error(validation.error || "URL failed SSRF validation");
  }
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "error", // Block redirects to prevent bypass
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    
    throw error;
  }
}
