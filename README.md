# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Email verification for production

Before deploying, run `database/email-verification-migration.sql` once against the app's PostgreSQL database. Configure these variables in the server environment (do not commit their values):

- `SMTP_HOST`: SMTP server hostname.
- `SMTP_PORT`: usually `465` for implicit TLS or `587` for STARTTLS.
- `SMTP_SECURE`: `true` for port 465; `false` for port 587. If omitted, it is inferred from the port.
- `SMTP_USER` and `SMTP_PASS`: SMTP account credentials. For Gmail, use an app password.
- `SMTP_FROM`: sender address; defaults to `SMTP_USER`.
- `OTP_SECRET`: a private random secret used to hash verification codes; if omitted, the server uses `JWT_SECRET`.

`POST /api/auth/signup` creates a pending registration and emails a six-digit code. `POST /api/auth/request-code` resends it after 60 seconds. `POST /api/auth/verify` accepts up to five attempts; codes expire after 10 minutes. A successful verification remains valid for 30 minutes while the user completes their profile.

## Backend security configuration

In production, configure `CORS_ORIGINS` as a comma-separated list of exact web origins allowed to call the API (for example, `https://app.example.com`). Native clients do not need an Origin entry. The API requires a valid `Bearer` session token for private routes, and uploaded chat/finance files are served through signed links that expire after one hour. `JWT_SECRET` must be a private, high-entropy value shared by all server instances.

Run the feature migrations required by the deployed version before starting the API, including `database/email-verification-migration.sql`, `database/manual-patient-migration.sql`, `database/apple-login-migration.sql`, `database/role-migration.sql`, `database/notifications-push-migration.sql`, `database/chat-migration.sql`, `database/mood-checkin-migration.sql`, and `database/symptom-emergency-migration.sql`.
