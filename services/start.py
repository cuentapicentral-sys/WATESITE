import os
import socket
import sys
import time
from urllib.parse import quote

SERVICE_MODULES = {
    "container-service": "services.containers.main",
    "route-service": "services.routes.main",
    "fleet-service": "services.fleet.main",
    "citizen-service": "services.citizens.main",
    "sensor-service": "services.sensors.main",
    "reporting-service": "services.reporting.main",
    "notification-service": "services.notifications.main",
    "analytics-service": "services.analytics.main",
}


def configure_rabbitmq() -> None:
    host = os.getenv("RABBITMQ_HOST")
    if not host:
        return

    port = int(os.getenv("RABBITMQ_PORT", "5672"))
    for attempt in range(30):
        try:
            with socket.create_connection((host, port), timeout=2):
                break
        except OSError:
            if attempt == 29:
                raise
            time.sleep(2)

    username = quote(os.getenv("RABBITMQ_USER", "wastewise"), safe="")
    password = quote(os.getenv("RABBITMQ_PASSWORD", ""), safe="")
    os.environ["RABBITMQ_URL"] = f"amqp://{username}:{password}@{host}:{port}/%2F"


def main() -> None:
    configure_rabbitmq()
    module = (
        os.getenv("SERVICE_MODULE")
        or SERVICE_MODULES[os.environ["RENDER_SERVICE_NAME"]]
    )
    port = os.getenv("PORT", "8000")
    os.execvp(
        "uvicorn", ["uvicorn", f"{module}:app", "--host", "0.0.0.0", "--port", port]
    )


if __name__ == "__main__":
    try:
        main()
    except (KeyError, OSError, ValueError) as error:
        print(f"Could not start microservice: {error}", file=sys.stderr)
        raise SystemExit(1) from error
