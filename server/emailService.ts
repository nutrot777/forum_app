import sgMail from '@sendgrid/mail';

// SendGrid setup
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
if (!SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY is not set. Email notifications will not be sent.");
}

const isEmailConfigured = !!SENDGRID_API_KEY;
if (isEmailConfigured) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * Send an email notification
 * @param to Recipient email address
 * @param subject Email subject
 * @param htmlContent Email HTML content
 * @param textContent Email plain text content
 * @returns Promise resolving to true if email was sent successfully, false otherwise
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<boolean> {
  if (!isEmailConfigured) {
    console.warn("Email service not configured. Skipping email to:", to);
    return false;
  }

  try {
    const msg = {
      to,
      from: 'notifications@discussionforum.com', // Use your configured sender email
      subject,
      text: textContent,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`Email notification sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
}

/**
 * Generate an email for a new reply notification
 */
export function generateReplyNotificationEmail(
  username: string,
  replierUsername: string,
  discussionTitle: string,
  replyContent: string,
  discussionId: number
): { html: string; text: string } {
  // Generate the full URL to the discussion
  const discussionUrl = `${process.env.APP_URL || ''}/discussions/${discussionId}`;
  
  // HTML version
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0079D3;">New Reply in Discussion Forum</h2>
      <p>Hello ${username},</p>
      <p><strong>${replierUsername}</strong> has replied to your discussion: <strong>${discussionTitle}</strong></p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p>${replyContent}</p>
      </div>
      <p><a href="${discussionUrl}" style="background-color: #0079D3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Discussion</a></p>
      <p style="color: #888; font-size: 12px; margin-top: 20px;">
        You received this email because you have email notifications enabled. 
        To disable them, go to your Profile Settings.
      </p>
    </div>
  `;
  
  // Plain text version
  const text = `
    New Reply in Discussion Forum
    
    Hello ${username},
    
    ${replierUsername} has replied to your discussion: ${discussionTitle}
    
    Reply: ${replyContent}
    
    View the discussion here: ${discussionUrl}
    
    You received this email because you have email notifications enabled. To disable them, go to your Profile Settings.
  `;
  
  return { html, text };
}

/**
 * Generate an email for a helpful mark notification
 */
export function generateHelpfulNotificationEmail(
  username: string,
  markerUsername: string,
  contentTitle: string,
  contentType: 'discussion' | 'reply',
  contentId: number
): { html: string; text: string } {
  // Generate the full URL to the discussion/reply
  const contentUrl = `${process.env.APP_URL || ''}/discussions/${contentId}`;
  
  const contentTypeDisplay = contentType === 'discussion' ? 'discussion' : 'reply';
  
  // HTML version
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0079D3;">Your ${contentTypeDisplay} was marked as helpful!</h2>
      <p>Hello ${username},</p>
      <p><strong>${markerUsername}</strong> has marked your ${contentTypeDisplay} "${contentTitle}" as helpful.</p>
      <p><a href="${contentUrl}" style="background-color: #0079D3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Content</a></p>
      <p style="color: #888; font-size: 12px; margin-top: 20px;">
        You received this email because you have email notifications enabled. 
        To disable them, go to your Profile Settings.
      </p>
    </div>
  `;
  
  // Plain text version
  const text = `
    Your ${contentTypeDisplay} was marked as helpful!
    
    Hello ${username},
    
    ${markerUsername} has marked your ${contentTypeDisplay} "${contentTitle}" as helpful.
    
    View it here: ${contentUrl}
    
    You received this email because you have email notifications enabled. To disable them, go to your Profile Settings.
  `;
  
  return { html, text };
}