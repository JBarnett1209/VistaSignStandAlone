"""
Route53 helper to upsert and delete TXT records for DNS-01 challenges.
"""

from typing import Optional
import time
import boto3
from botocore.config import Config
from app.core.config import settings


def _client():
    session = boto3.session.Session(
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION or "us-east-1",
    )
    return session.client("route53", config=Config(retries={"max_attempts": 5, "mode": "standard"}))


def upsert_txt_record(name: str, value: str, ttl: int = 60) -> str:
    """Create or update a TXT record. Returns change ID."""
    client = _client()
    response = client.change_resource_record_sets(
        HostedZoneId=settings.ROUTE53_HOSTED_ZONE_ID,
        ChangeBatch={
            "Comment": "VistaSign DNS-01 upsert",
            "Changes": [
                {
                    "Action": "UPSERT",
                    "ResourceRecordSet": {
                        "Name": name,
                        "Type": "TXT",
                        "TTL": ttl,
                        "ResourceRecords": [{"Value": f'"{value}"'}],
                    },
                }
            ],
        },
    )
    return response["ChangeInfo"]["Id"]


def delete_txt_record(name: str, value: str, ttl: int = 60) -> str:
    """Delete a TXT record. Returns change ID."""
    client = _client()
    response = client.change_resource_record_sets(
        HostedZoneId=settings.ROUTE53_HOSTED_ZONE_ID,
        ChangeBatch={
            "Comment": "VistaSign DNS-01 delete",
            "Changes": [
                {
                    "Action": "DELETE",
                    "ResourceRecordSet": {
                        "Name": name,
                        "Type": "TXT",
                        "TTL": ttl,
                        "ResourceRecords": [{"Value": f'"{value}"'}],
                    },
                }
            ],
        },
    )
    return response["ChangeInfo"]["Id"]


def wait_for_change(change_id: str, timeout_seconds: int = 180) -> bool:
    """Wait until Route53 marks change as INSYNC."""
    client = _client()
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        resp = client.get_change(Id=change_id)
        if resp.get("ChangeInfo", {}).get("Status") == "INSYNC":
            return True
        time.sleep(5)
    return False


