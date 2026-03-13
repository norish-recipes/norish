## 1. Backend URL Persistence Foundation

- [x] 1.1 Add `expo-secure-store` to the mobile app dependencies
- [x] 1.2 Add a backend URL storage utility for loading/saving/clearing and URL normalization
- [x] 1.3 Add endpoint helper functions for backend health and tRPC URLs

## 2. Startup Routing and Connect Screen

- [x] 2.1 Update mobile startup route logic to redirect to connect screen when no backend URL is saved
- [x] 2.2 Add a connect screen with HeroUI card, base URL input, and connect button
- [x] 2.3 Implement connect action to validate with `/api/health`, persist URL, and route to tabs on success

## 3. Verification

- [x] 3.1 Run mobile lint/typecheck scope for changed files and resolve any issues
