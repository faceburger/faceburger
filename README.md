# Daily Orders Report

The app can email a daily orders report to `faceburger05@gmail.com` using a Vercel cron job and Resend.

## Required Environment Variables

Set these in Vercel Project Settings:

- `RESEND_API_KEY`: API key from Resend
- `CRON_SECRET`: secret used by Vercel Cron and validated by `/api/reports/daily`
- `DAILY_REPORT_EMAIL_FROM`: verified sender, for example `Faceburger <reports@yourdomain.com>`
- `DAILY_REPORT_EMAIL_TO`: optional override for the recipient, defaults to `faceburger05@gmail.com`
- `DAILY_REPORT_TIMEZONE`: optional, defaults to `Africa/Casablanca`

## How It Runs

- `vercel.json` schedules `/api/reports/daily` every hour at minute `05`
- the route only sends the email when the Morocco local hour is `03`
- the route stores the last sent report date so the same daily report is not emailed twice

## Manual Test

After deployment and env setup, you can manually test the route with:

`GET /api/reports/daily?force=1`

Send the request with:

`Authorization: Bearer <CRON_SECRET>`
