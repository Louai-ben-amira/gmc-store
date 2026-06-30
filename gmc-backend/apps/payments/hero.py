"""Hero-slide image helpers.

Hero slides live in the ``HERO_SLIDES`` site setting as a JSON list. Each
slide's ``image`` is persisted as a *relative storage key* (e.g.
``hero_slides/foo.png``) — never a full URL — so it is independent of the
storage backend and public domain, exactly like a Django ``ImageField``.

Full URLs are resolved at the API boundary through the active storage backend
(Cloudflare R2 in production, local media in development). This keeps stored
data portable: changing the R2 public domain never breaks existing slides.
"""
from __future__ import annotations

import json
from typing import Callable
from urllib.parse import unquote, urlparse

from django.core.files.storage import default_storage


def to_key(image: str) -> str:
    """Normalize any image reference (full URL or key) to a relative storage key.

    The canonical key is *decoded* (matches the real object key, e.g. with
    literal spaces). When given a full URL we unquote its path so the storage
    backend can re-encode exactly once when building the URL — avoiding the
    ``%20`` → ``%2520`` double-encoding trap.
    """
    if not image:
        return image
    path = unquote(urlparse(image).path) if '://' in image else image
    path = path.lstrip('/')
    if path.startswith('media/'):          # strip legacy local-storage prefix
        path = path[len('media/'):]
    return path


def to_url(image: str) -> str:
    """Resolve a stored image key to a full served URL via the active backend."""
    key = to_key(image)
    return default_storage.url(key) if key else key


def _map_images(raw: str, fn: Callable[[str], str]) -> str:
    """Apply ``fn`` to every slide's ``image`` in a HERO_SLIDES JSON string."""
    try:
        slides = json.loads(raw or '[]')
    except (ValueError, TypeError):
        return raw
    if not isinstance(slides, list):
        return raw
    for slide in slides:
        if isinstance(slide, dict) and slide.get('image'):
            slide['image'] = fn(slide['image'])
    return json.dumps(slides)


def slides_to_keys(raw: str) -> str:
    """Full-URL JSON → relative-key JSON (for persistence)."""
    return _map_images(raw, to_key)


def slides_to_urls(raw: str) -> str:
    """Relative-key JSON → full-URL JSON (for API responses)."""
    return _map_images(raw, to_url)
