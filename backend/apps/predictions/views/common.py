import json
from hashlib import sha256

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError

from apps.predictions.models import ModelVersion
from apps.predictions.services.fpl_client import FPLServiceUnavailable


class FPLUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "FPL API unavailable and no cached data."


ML_RESPONSE_CACHE_TTL_SECONDS = 60 * 5


def handle_fpl_error(exc: Exception):
    if isinstance(exc, FPLServiceUnavailable):
        raise FPLUnavailable() from exc
    raise exc


def validate_model_type(model_type: str | None, allow_empty: bool = False):
    if allow_empty and not model_type:
        return None

    valid = {choice[0] for choice in ModelVersion.ModelType.choices}
    if model_type not in valid:
        raise ValidationError("Invalid model_type")
    return model_type


def build_ml_cache_key(prefix: str, payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    digest = sha256(encoded.encode("utf-8")).hexdigest()
    return f"ml-response:{prefix}:{digest}"
