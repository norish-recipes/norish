import { z } from "zod";

/**
 * Optional client-minted entity id accepted by create procedures.
 *
 * Offline create-then-edit chains break if the server mints entity ids at insert
 * time: every queued mutation behind the create references an id the server never
 * issued. Create inputs on the hero offline surfaces therefore accept an optional
 * client-generated UUID and insert with it; the server mints one when absent
 * (ADR-0003). Reuse this wherever a create input takes a client-minted id.
 */
export const clientMintedId = z.uuid().optional();
