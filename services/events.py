import json
import logging
import os
import threading
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse

logger = logging.getLogger(__name__)


def publish_event(event_type: str, payload: dict, routing_key: str | None = None) -> bool:
    """Publish a domain event without making the request fail when the broker is unavailable."""
    broker_url = os.getenv("RABBITMQ_URL")
    if not broker_url:
        return False

    try:
        import pika

        parsed = urlparse(broker_url)
        credentials = pika.PlainCredentials(parsed.username or "guest", parsed.password or "guest")
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=parsed.hostname or "localhost",
                port=parsed.port or 5672,
                virtual_host=unquote(parsed.path.lstrip("/")) or "/",
                credentials=credentials,
                connection_attempts=1,
                retry_delay=0,
            )
        )
        channel = connection.channel()
        channel.exchange_declare(exchange="wastewise.events", exchange_type="topic", durable=True)
        channel.basic_publish(
            exchange="wastewise.events",
            routing_key=routing_key or event_type,
            body=json.dumps({
                "event_id": f"{event_type}:{datetime.now(timezone.utc).timestamp()}",
                "event_type": event_type,
                "occurred_at": datetime.now(timezone.utc).isoformat(),
                "payload": payload,
            }, default=str),
            properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
        )
        connection.close()
        return True
    except Exception as error:
        logger.warning("Event broker unavailable for %s: %s", event_type, error)
        return False


def consume_events(queue_name: str, routing_keys: list[str], handler) -> None:
    """Run a durable topic consumer in a daemon thread for a domain service."""
    broker_url = os.getenv("RABBITMQ_URL")
    if not broker_url:
        return

    def consume() -> None:
        try:
            import pika

            parsed = urlparse(broker_url)
            credentials = pika.PlainCredentials(parsed.username or "guest", parsed.password or "guest")
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=parsed.hostname or "localhost",
                    port=parsed.port or 5672,
                    virtual_host=unquote(parsed.path.lstrip("/")) or "/",
                    credentials=credentials,
                    connection_attempts=3,
                    retry_delay=2,
                )
            )
            channel = connection.channel()
            channel.exchange_declare(exchange="wastewise.events", exchange_type="topic", durable=True)
            channel.queue_declare(queue=queue_name, durable=True)
            for routing_key in routing_keys:
                channel.queue_bind(queue=queue_name, exchange="wastewise.events", routing_key=routing_key)

            def on_message(channel, method, properties, body):
                try:
                    handler(json.loads(body))
                    channel.basic_ack(delivery_tag=method.delivery_tag)
                except Exception:
                    logger.exception("Could not process event on %s", queue_name)
                    channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

            channel.basic_consume(queue=queue_name, on_message_callback=on_message)
            channel.start_consuming()
        except Exception as error:
            logger.warning("Event consumer unavailable for %s: %s", queue_name, error)

    threading.Thread(target=consume, name=queue_name, daemon=True).start()
