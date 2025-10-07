"""
Email utility for sending via Gmail SMTP using OAuth2 (XOAUTH2).
"""

from typing import Optional
import base64
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
import requests

from app.core.config import settings


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


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


def _generate_oauth2_string(username: str, access_token: str) -> str:
    auth_string = f"user={username}\x01auth=Bearer {access_token}\x01\x01"
    return base64.b64encode(auth_string.encode("utf-8")).decode("utf-8")


def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """Send an email via Gmail SMTP with OAuth2.

    Returns True on success, False otherwise.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    from_email = settings.FROM_EMAIL or "no-reply@example.com"
    from_name = settings.FROM_NAME or "VistaSign"

    logger.info(f"Attempting to send email to {to_email} from {from_email}")

    access_token = _get_oauth2_access_token()
    if not access_token:
        logger.error("Failed to get OAuth2 access token")
        return False

    logger.info("Successfully obtained OAuth2 access token")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = to_email

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # Gmail SMTP
    smtp_server = "smtp.gmail.com"
    smtp_port = 587

    auth_string = _generate_oauth2_string(from_email, access_token)
    logger.info(f"Generated OAuth2 auth string (first 50 chars): {auth_string[:50]}...")

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            logger.info("Attempting XOAUTH2 authentication...")
            server.docmd("AUTH", "XOAUTH2 " + auth_string)
            logger.info("XOAUTH2 authentication successful, sending email...")
            server.sendmail(from_email, [to_email], msg.as_string())
        
        logger.info(f"Successfully sent email to {to_email}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication failed: {e}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email: {e}")
        return False


