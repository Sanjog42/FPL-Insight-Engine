import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache


DEFAULT_TTL_SECONDS = 60 * 10
BOOTSTRAP_TTL_SECONDS = 60 * 60
SUMMARY_TTL_SECONDS = 60 * 30


class FPLServiceUnavailable(Exception):
    pass


def _base_url() -> str:
    return getattr(settings, "FPL_BASE_URL", "https://fantasy.premierleague.com/api")


def _fetch_json(url: str, timeout: int = 12):
    req = Request(
        url,
        headers={"User-Agent": "FPL-Insight-Engine/1.0"},
    )
    with urlopen(req, timeout=timeout) as resp:  # nosec - external API only
        data = resp.read().decode("utf-8")
        return json.loads(data)


def _get_cached_json(
    cache_key: str,
    url: str,
    ttl: int,
    force_refresh: bool = False,
    not_found_raises_key_error: bool = False,
):
    if not force_refresh:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached, True

    try:
        data = _fetch_json(url)
    except HTTPError as exc:
        if not_found_raises_key_error and exc.code == 404:
            raise KeyError("not_found") from exc
        cached = cache.get(cache_key)
        if cached is not None:
            return cached, True
        raise FPLServiceUnavailable(str(exc)) from exc
    except (URLError, ValueError) as exc:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached, True
        raise FPLServiceUnavailable(str(exc)) from exc

    cache.set(cache_key, data, ttl)
    return data, False


def get_bootstrap(force_refresh: bool = False):
    url = f"{_base_url()}/bootstrap-static/"
    return _get_cached_json("fpl:bootstrap", url, BOOTSTRAP_TTL_SECONDS, force_refresh)


def get_fixtures(force_refresh: bool = False):
    url = f"{_base_url()}/fixtures/"
    return _get_cached_json("fpl:fixtures", url, DEFAULT_TTL_SECONDS, force_refresh)


def get_element_summary(player_id: int, force_refresh: bool = False):
    url = f"{_base_url()}/element-summary/{player_id}/"
    return _get_cached_json(
        f"fpl:element-summary:{player_id}",
        url,
        SUMMARY_TTL_SECONDS,
        force_refresh,
        not_found_raises_key_error=True,
    )
