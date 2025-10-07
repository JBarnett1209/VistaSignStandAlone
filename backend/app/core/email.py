"""
Email utility for sending via Gmail API using OAuth2.
"""

from typing import Optional
import base64
import json
import requests

from app.core.config import settings


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def _get_oauth2_access_token() -> Optional[str]:
    """Exchange refresh token for an access token."""
    if not (
        settings.GOOGLE_CLIENT_ID
        and settings.GOOGLE_CLIENT_SECRET
        and settings.GOOGLE_REFRESH_TOKEN
    ):
        import logging
        logger = logging.getLogger(__name__)
        logger.error("Missing Google OAuth2 credentials")
        return None

    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": settings.GOOGLE_REFRESH_TOKEN,
        "grant_type": "refresh_token",
    }
    
    try:
        resp = requests.post(GOOGLE_TOKEN_URL, data=data, timeout=10)
        resp.raise_for_status()
        token = resp.json().get("access_token")
        
        if not token:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"No access token in response: {resp.json()}")
            return None
            
        return token
    except requests.exceptions.RequestException as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to get OAuth2 access token: {e}")
        return None


def _create_email_message(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> str:
    """Create a properly formatted email message for Gmail API."""
    from_email = settings.FROM_EMAIL or "no-reply@example.com"
    from_name = settings.FROM_NAME or "VistaSign"

    # Prepare plain text version outside the f-string to avoid backslashes in expressions
    if text_body is not None:
        plain_body = text_body
    else:
        plain_body = (
            html_body
            .replace('<br>', '\n')
            .replace('<br/>', '\n')
            .replace('<br />', '\n')
            .replace('</p>', '\n')
            .replace('<p>', '')
        )

    # Create the email message
    message = (
        f"From: {from_name} <{from_email}>\n"
        f"To: {to_email}\n"
        f"Subject: {subject}\n"
        "MIME-Version: 1.0\n"
        "Content-Type: multipart/alternative; boundary=\"boundary123\"\n\n"
        "--boundary123\n"
        "Content-Type: text/plain; charset=UTF-8\n\n"
        f"{plain_body}\n\n"
        "--boundary123\n"
        "Content-Type: text/html; charset=UTF-8\n\n"
        f"{html_body}\n\n"
        "--boundary123--\n"
    )
    return message


def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """Send an email via Gmail API using OAuth2.

    Returns True on success, False otherwise.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    from_email = settings.FROM_EMAIL or "no-reply@example.com"
    from_name = settings.FROM_NAME or "VistaSign"

    logger.info(f"Attempting to send email to {to_email} from {from_email} via Gmail API")

    access_token = _get_oauth2_access_token()
    if not access_token:
        logger.error("Failed to get OAuth2 access token")
        return False

    logger.info("Successfully obtained OAuth2 access token")

    # Create email message
    message = _create_email_message(to_email, subject, html_body, text_body)
    
    # Encode message for Gmail API
    message_bytes = message.encode('utf-8')
    message_b64 = base64.urlsafe_b64encode(message_bytes).decode('utf-8')
    
    # Prepare API request
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'raw': message_b64
    }
    
    try:
        logger.info("Sending email via Gmail API...")
        response = requests.post(GMAIL_API_URL, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        
        logger.info(f"Successfully sent email to {to_email} via Gmail API")
        return True
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Gmail API error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response content: {e.response.text}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email: {e}")
        return False


