# Norish Example Themes

Example custom themes for Norish demonstrating how to create and deploy custom color schemes.

## Available Examples

- **example-theme.css** - Minimal test theme overriding primary color and removing rounded corners

## Theme Files

Norish themes use CSS custom properties (variables) to override default colors. The app automatically handles light/dark mode switching.

### CSS Variable Structure

Each theme must define two mode-specific blocks:

```css
:root,
[data-theme="light"] {
  /* Light mode colors */
}

[data-theme="dark"] {
  /* Dark mode colors */
}
```

### Color Groups

Themes should define these semantic color groups (each with -50 to -900 variants and -foreground):

- `--primary` / `--primary-*` - Brand color
- `--secondary` / `--secondary-*` - Accent color
- `--success` / `--success-*` - Success states
- `--warning` / `--warning-*` - Warning states
- `--danger` / `--danger-*` - Error states
- `--info` / `--info-*` - Information states
- `--default` / `--default-*` - Neutral/grayscale

### Component Styling

Include CSS for common components to ensure visual consistency:

- **Buttons** - Border radius, hover states, color variants (danger, success)
- **Inputs** - Focus states, border colors, background
- **Cards/Sections** - Container colors, typography
- **Modals** - Elevated surfaces with appropriate radius
- **Links** - Color and hover behavior
- **Notifications** - Flash backgrounds for success, warning, danger, info

## Examples

**example-theme.css** demonstrates a minimal override example.

### Quick Reference

Light mode example:
```css
:root,
[data-theme="light"] {
  --primary-50: #eaffe9;
  --primary-100: #c5ffcd;
  /* ... more shades ... */
  --primary-900: #00210b;
  --primary: #336640;
  --primary-foreground: #ffffff;
}
```

Dark mode example:
```css
[data-theme="dark"] {
  --primary-50: #00210b;
  --primary-100: #003918;
  /* ... more shades ... */
  --primary-900: #b8f0bf;
  --primary: #9cd4a5;
  --primary-foreground: #003918;
}
```

### Border Radius

Including radius tokens in your theme helps maintain UI consistency:

```css
/* Optional: Define in both light and dark blocks */
--radius-sm: 0.375rem;    /* 6px - Small elements */
--radius-md: 0.5rem;      /* 8px - Standard buttons, inputs */
--radius-lg: 0.75rem;     /* 12px - Cards, modals */
--radius-xl: 1rem;        /* 16px - Large components */
--radius-full: 9999px;    /* Full - Rounded pills */
```

## File Size

Keep themes under 50KB. Use minification if needed:

```bash
npx csso default-theme.css -o default-theme.min.css
```

## Testing

Before deploying:
1. Test light mode - Text readable, contrast sufficient
2. Test dark mode - Colors properly inverted, contrast maintained
3. Test mobile - Colors adapt well at small sizes
4. Verify all components visible (buttons, inputs, modals)
5. Check with color-blind simulators
6. Test notification/flash backgrounds on both modes

## Hosting Your Theme

### GitHub Pages (Recommended - Free)

1. Create a new repository: `norish-theme-{name}`
2. Add your `theme.css` file to the repo
3. Enable GitHub Pages: Settings → Pages → Source: main
4. Use the raw content URL:
   ```
   https://raw.githubusercontent.com/username/norish-theme-name/main/theme.css
   ```

### Other Platforms

- **Vercel / Netlify** - Deploy static files, use public URL
- **Firebase Hosting** - Static hosting with HTTPS
- **Any server** - Just ensure HTTPS and proper CORS headers

All URLs must be HTTPS and world-accessible.

## Sharing with Community

Once your theme is live and tested:

For advanced distribution:

```bash
# Minify CSS for production
npx csso custom-theme.css -o custom-theme.min.css

# Create a GitHub release with the theme file
git tag v1.0.0
git push origin v1.0.0
```

1. **Test in Norish** - Paste the URL in Admin Settings → Theme Configuration
2. **Share on Forum** - Post in the relevant forum channel
3. **Tag on Social Media/GitHub** - Use `#norish-theme` for discoverability

## License

Feel free to use this theme as a template for your own custom themes!
