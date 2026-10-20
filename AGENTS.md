# AGENTS.md — Piattaforma web per nutrizionisti e clienti

## Project overview

Create a responsive web application for nutritionists and their clients.

The platform allows clients to register, log in, manage personal goals, track progress, view appointments and receive communications from their nutritionist. Clients can also voluntarily share selected achievements with a motivational community.

This project is also a learning exercise for Supabase. Keep the implementation simple, readable and suitable for someone learning frontend development, JavaScript and database integration.

## Stack

- HTML5 for page structure.
- CSS3 for styling and responsive layouts.
- Vanilla JavaScript using modern ES6+ syntax.
- Supabase Auth for user registration, login and session management.
- Supabase PostgreSQL for persistent data storage.
- Supabase Row Level Security (RLS) for database access control.
- Supabase JavaScript client library loaded using the official CDN or another simple, documented browser-compatible approach.
- No frontend frameworks or libraries other than the Supabase client library, unless explicitly requested.

Do not use React, React Native, Vue, Angular, TypeScript or frontend frameworks.

Do not introduce a build system or package manager unless the project genuinely requires one.

## Project structure

Keep the project organized using the following structure, adapting it only when necessary:

- `index.html`: homepage or main application page.
- `login.html`: login page.
- `register.html`: registration page.
- `dashboard.html`: authenticated client dashboard.
- `community.html`: motivational community.
- `css/style.css`: global styles and responsive design.
- `js/config.js`: Supabase project configuration.
- `js/main.js`: shared application logic and navigation.
- `js/auth.js`: registration, login, logout and session management.
- `js/dashboard.js`: client dashboard and personal goals.
- `js/community.js`: community feed and achievement sharing.
- `db.sql`: SQL schema, constraints, indexes and RLS policies.
- `AGENTS.md`: project instructions.

Use relative imports and file paths consistently.

Do not place all application logic in one JavaScript file.

## Supabase configuration

- Define the Supabase client variable as `supabaseClient`.
- Store the Supabase project URL and public key in `js/config.js`.
- Use explicit placeholders in the configuration file, for example:

  ```javascript
  const SUPABASE_URL = "YOUR_SUPABASE_URL";
  const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  );
  ```

- Load the Supabase library before `config.js`.
- Ensure `supabaseClient` is available to the other scripts using a consistent module or script-loading strategy.
- Do not mix JavaScript module imports and classic scripts without understanding their scope and loading behavior.
- Replace placeholder values with the actual project URL and publishable key from the Supabase dashboard.
- Never include a Supabase secret key or legacy `service_role` key in frontend code.
- The Supabase URL and publishable key are designed for client-side use; security must be enforced through authentication, database permissions and RLS.
- Do not commit private credentials or secrets to the repository.

## Database and SQL

- All SQL instructions required to configure the Supabase database must be defined in `db.sql`.
- Include table creation, primary keys, foreign keys, constraints, indexes and RLS policies.
- Enable RLS on every table exposed to the application through the Supabase Data API.
- Define explicit policies for `SELECT`, `INSERT`, `UPDATE` and `DELETE` wherever those operations are required.
- Grant users access only to the records and operations they are authorized to use.
- Use `auth.uid()` to associate database records with the authenticated Supabase user.
- Use UUIDs for user-related record identifiers where appropriate.
- Use timestamps such as `created_at` and `updated_at` when useful.
- Use database constraints to enforce data integrity instead of relying exclusively on JavaScript validation.
- Never assume that hiding a button or checking the current user in JavaScript provides database security.
- Never disable RLS to make a feature work.
- Do not use a service-role key in browser requests.
- Keep `db.sql` synchronized with the actual database schema and policies.

## Suggested database tables

Create only the tables required by the implemented features.

### `profiles`

Stores basic application profile information associated with a Supabase Auth user.

Suggested fields:

- `id`: UUID referencing `auth.users.id`.
- `display_name`: public or display name.
- `role`: client or nutritionist, with role assignment protected against unauthorized changes.
- `created_at`: creation timestamp.

Users must not be able to assign themselves privileged roles by modifying client-side requests.

### `goals`

Stores personal goals belonging to clients.

Suggested fields:

- `id`: UUID primary key.
- `user_id`: UUID referencing the owner.
- `title`: goal title.
- `description`: optional description.
- `status`: current goal status.
- `created_at`: creation timestamp.

Only the owner and explicitly authorized parties may access the relevant records.

### `achievements`

Stores personal achievements and progress entries.

Suggested fields:

- `id`: UUID primary key.
- `user_id`: UUID referencing the owner.
- `title`: achievement title.
- `description`: optional description.
- `category`: achievement category.
- `is_shared`: whether the achievement has been explicitly shared with the community.
- `created_at`: creation timestamp.

Keep achievements private by default. Do not publish an achievement merely because it exists in the database.

### `appointments`

Stores appointment requests and bookings.

Suggested fields:

- `id`: UUID primary key.
- `client_id`: UUID referencing the client.
- `nutritionist_id`: UUID referencing the nutritionist's profile.
- `scheduled_at`: appointment date and time.
- `status`: appointment status.
- `created_at`: creation timestamp.

Clients must not be able to confirm their own appointments or modify another user's appointments without appropriate authorization.

Prevent conflicting bookings through appropriate database constraints or transactional server-side logic where necessary.

### `messages`

Stores communications between nutritionists and their authorized clients.

Suggested fields:

- `id`: UUID primary key.
- `sender_id`: UUID referencing the sender.
- `recipient_id`: UUID referencing the recipient.
- `content`: message content.
- `created_at`: creation timestamp.

Only authorized participants may read the relevant messages.

### Database implementation rules

- Start with `profiles`, `goals` and `achievements` if a smaller initial implementation is sufficient.
- Add appointments and messages only when implementing those features.
- Avoid creating unnecessary tables before their functionality is needed.
- Define foreign keys, appropriate indexes and constraints.
- Define RLS policies for each table according to its intended access patterns.
- For shared achievements, ensure that public community queries can retrieve only explicitly shared fields and never expose private records or unnecessary personal information.
- Do not expose private health-related measurements through a broadly readable table or policy.
- When necessary, use a carefully restricted database view or a dedicated RPC function to expose only approved community data.
- Remember that views and database functions must be configured so they do not bypass the intended security rules.

## Authentication

Use Supabase Auth for real user registration and authentication.

Implement:

- User registration with email and password.
- Login with email and password.
- Logout.
- Session restoration when the page is reloaded.
- Authentication state checks for protected pages.
- Clear feedback for invalid credentials and authentication errors.
- Handling of email confirmation when enabled in the Supabase project.
- Appropriate redirection after successful login or logout.

Use the official Supabase JavaScript client methods.

Do not implement password storage yourself.

Do not store passwords or authentication tokens in application-managed `localStorage`.

Allow Supabase to manage its authentication session using the client's supported configuration.

Never trust a user ID supplied by the browser when determining ownership of a database record. Use the authenticated identity and enforce authorization through RLS.

## User roles and permissions

Support two principal roles:

### Client

- Manages their own profile.
- Creates and manages personal goals.
- Records personal achievements.
- Views their own appointments and communications.
- Chooses which achievements to share with the community.
- Can revoke sharing when supported by the implementation.

### Nutritionist

- Manages their professional profile.
- Views appointments and communications associated with authorized clients.
- Sends communications to authorized clients.
- Accesses only the information permitted by the application's authorization model.

Role assignment and role changes must be protected against unauthorized modification.

Do not grant nutritionist privileges merely because a user selects that role during public registration. Use a trusted administrative process for professional role assignment.

Implement role-specific access in both the interface and the database policies.

## Dashboard

Create a simple, responsive client dashboard containing:

- A welcome message.
- Personal goals.
- Recent achievements.
- Upcoming appointments.
- Messages or announcements from the nutritionist.
- A clear link to the community.

Load persistent records from Supabase.

Show loading, empty and error states.

Do not silently replace failed database requests with fabricated success messages.

Use synthetic sample data only when explicitly presenting a demo.

## Goals and achievements

- Allow clients to create, view and manage their own goals.
- Allow clients to record achievements such as improved consistency, a completed personal goal or progress measured by an agreed indicator.
- Do not treat weight loss as the only measure of success.
- Present progress in a positive and non-judgmental way.
- Keep achievements private by default.
- Require an explicit user action before sharing an achievement.
- Ensure the community receives only the fields approved for sharing.
- Never automatically publish private notes, measurements or health information.
- Validate input in JavaScript and enforce relevant data integrity constraints in PostgreSQL.

## Community

Create a motivational feed displaying achievements that users have explicitly chosen to share.

- Retrieve shared achievements from Supabase.
- Allow positive reactions if the feature is implemented.
- Do not display private achievements.
- Do not expose email addresses, internal user IDs, private measurements or other unnecessary personal information.
- Use display names or pseudonyms according to the implemented privacy settings.
- Prevent unauthorized users from modifying or deleting another user's content.
- Provide clear error handling when loading or posting content fails.
- Do not present a local-only demo feed as a real community shared across accounts.

Community visibility must be enforced by database policies, not just by frontend filters.

## Privacy and security

- Treat weight, body measurements and nutrition-related records as potentially sensitive personal data.
- Collect only the information necessary for the implemented features.
- Keep personal records private by default.
- Require explicit, informed and revocable sharing choices.
- Enforce access control using RLS and appropriately restricted backend operations.
- Never expose Supabase secret or service-role keys in browser code.
- Do not rely on frontend validation as the sole security mechanism.
- Avoid exposing sensitive information in logs, URLs, error messages or public database queries.
- Use synthetic data during development and testing.
- Consider applicable GDPR obligations before processing real users' health-related information.
- Do not claim GDPR compliance without an appropriate review of the actual implementation and data processing.

## Frontend and coding guidelines

- Use semantic HTML5.
- Use CSS3 for all styling.
- Use modern JavaScript and ES6+ syntax.
- Avoid legacy JavaScript patterns such as `var`.
- Prefer `const` by default and use `let` when reassignment is necessary.
- Use descriptive variable and function names.
- Use `async`/`await` for asynchronous Supabase operations.
- Handle rejected promises and database errors explicitly.
- Avoid unnecessary global variables.
- Keep DOM manipulation and database access organized into reusable functions.
- Do not add JavaScript libraries or frameworks beyond the Supabase client unless explicitly requested.
- Do not use inline event handlers such as `onclick` when `addEventListener` is appropriate.
- Keep CSS reusable and responsive.
- Never hardcode real user data or credentials.
- Use a local development server when needed rather than assuming every browser feature works when opening files through `file://`.

## Testing instructions

- Verify registration, login, logout and session restoration.
- Test behavior when email confirmation is enabled.
- Verify that unauthenticated users cannot access protected data.
- Test that users cannot read, modify or delete another user's private records.
- Test that only explicitly shared achievements appear in the community.
- Verify that users cannot grant themselves the nutritionist role.
- Test database errors, empty results and invalid input.
- Test the responsive layout on desktop and mobile screen sizes.
- Check the browser console for JavaScript errors.
- Review the SQL policies in `db.sql` and test them using different authenticated accounts.
- Use synthetic data only.
- Do not claim tests have passed unless they have actually been run.

## Development workflow

1. Inspect the existing project before making changes.
2. Confirm that `config.js` initializes `supabaseClient` correctly.
3. Implement and review the required SQL in `db.sql`.
4. Configure the Supabase project using the SQL provided.
5. Build the frontend in small, testable steps.
6. Connect each implemented feature to Supabase.
7. Verify the relevant RLS policies before relying on a database operation.
8. Test with separate accounts and different permission levels.
9. Fix errors before adding more features.
10. Document any required manual configuration in the Supabase dashboard.

## MVP priorities

1. Create the HTML, CSS and JavaScript structure.
2. Build a responsive homepage.
3. Configure Supabase and create `db.sql`.
4. Implement real registration, login and logout.
5. Create profiles and protect them with RLS.
6. Build the authenticated dashboard.
7. Implement private goals and achievements.
8. Add explicit achievement sharing and the community feed.
9. Add appointments and nutritionist communications.
10. Review security and privacy before allowing real users to use the platform.

## Final rule

Build a working, responsive website using HTML, CSS, vanilla JavaScript and Supabase.

Prioritize learning, clarity, maintainability and secure database access. Keep the implementation appropriate for a beginner-friendly project without weakening authentication, database permissions or privacy.

Do not pretend that a feature works when it is only a visual mockup. Clearly distinguish implemented functionality from planned functionality.
