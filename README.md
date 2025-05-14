# StudentForum - Discussion Platform

A dynamic discussion platform that enables real-time, threaded conversations with rich media sharing and interactive user experiences.

## Features

- Threaded discussions with replies
- User authentication
- Online user presence indicators
- Email notifications for replies and helpful marks
- User profile settings
- Light/dark mode support
- Mobile-responsive design

## Tech Stack

- **Frontend**: React with TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Email**: SendGrid
- **Real-time**: WebSockets

## Local Setup Instructions

### Prerequisites

- Node.js (v18+)
- PostgreSQL database

### Installation Steps

1. **Clone the repository**

```bash
git clone <repository-url>
cd student-forum
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up the database**

Create a new PostgreSQL database and import the schema:

```bash
psql -U your_username -d your_database_name -f schema.sql
```

4. **Configure environment variables**

Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
SENDGRID_API_KEY=your_sendgrid_api_key (optional)
```

5. **Start the application**

```bash
npm run dev
```

The application should now be running at `http://localhost:5000`.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Log in a user
- `POST /api/auth/logout` - Log out a user

### Discussions
- `GET /api/discussions` - Get all discussions
- `GET /api/discussions/:id` - Get a specific discussion
- `POST /api/discussions` - Create a new discussion
- `PATCH /api/discussions/:id` - Update a discussion
- `DELETE /api/discussions/:id` - Delete a discussion

### Replies
- `POST /api/replies` - Create a new reply
- `PATCH /api/replies/:id` - Update a reply
- `DELETE /api/replies/:id` - Delete a reply

### Helpful Marks
- `POST /api/helpful` - Mark a discussion or reply as helpful
- `DELETE /api/helpful` - Remove a helpful mark
- `GET /api/helpful/check` - Check if a discussion or reply is marked as helpful

### Notifications
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/unread/count` - Get unread notification count
- `PATCH /api/notifications/:id/read` - Mark a notification as read
- `PATCH /api/notifications/read/all` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Delete a notification

### User Profile
- `PATCH /api/user/profile` - Update user profile

## Default User Credentials

Username: charles
Password: 12345678

## Email Notifications

Email notifications are sent via SendGrid. If you want to use this feature, you'll need to:

1. Sign up for a SendGrid account
2. Create an API key with "Mail Send" permissions
3. Add the API key to your `.env` file as `SENDGRID_API_KEY`

If no API key is provided, the application will still work but won't send email notifications.