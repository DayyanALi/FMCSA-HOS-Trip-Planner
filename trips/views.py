import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .hos import build_trip_plan


@csrf_exempt
def plan_trip(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        payload = json.loads(request.body.decode("utf-8"))
        result = build_trip_plan(payload)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except Exception as exc:
        return JsonResponse({"error": f"Unable to build trip plan: {exc}"}, status=500)

    return JsonResponse(result)

