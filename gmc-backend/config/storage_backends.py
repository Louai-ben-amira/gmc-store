"""Custom django-storages backends.

Cloudflare R2 is S3-compatible, so we reuse django-storages' battle-tested
``S3Boto3Storage`` and only override the handful of attributes that differ for
R2. All credentials and endpoints come from Django settings (which in turn read
environment variables) — nothing is hardcoded here.
"""
from __future__ import annotations

from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class R2Storage(S3Boto3Storage):
    """Default media storage backed by a Cloudflare R2 bucket.

    Differences from plain S3 that matter for R2:

    * ``endpoint_url`` points at the per-account R2 endpoint.
    * ``region_name = "auto"`` — R2 ignores regions.
    * ACLs are disabled — R2 has no ACL support. Objects are private by default
      and exposed publicly via the bucket's public URL / a custom domain.
    * ``addressing_style = "path"`` — R2 expects path-style addressing.

    Whether URLs are signed is driven by settings: if a public URL / custom
    domain is configured the bucket is treated as public and URLs are served
    unsigned through that domain; otherwise URLs are signed (querystring auth).
    """

    access_key = settings.R2_ACCESS_KEY
    secret_key = settings.R2_SECRET_KEY
    bucket_name = settings.R2_BUCKET_NAME
    endpoint_url = settings.R2_ENDPOINT_URL
    region_name = "auto"
    default_acl = None
    file_overwrite = False
    addressing_style = "path"
    signature_version = "s3v4"
    custom_domain = settings.R2_CUSTOM_DOMAIN or None
    querystring_auth = settings.R2_QUERYSTRING_AUTH
