from prometheus_fastapi_instrumentator import Instrumentator


def instrument_app(app, service_name: str) -> None:
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=False,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics"],
        inprogress_name=f"{service_name}_http_requests_inprogress",
        inprogress_labels=("method",),
    ).instrument(app).expose(
        app,
        endpoint="/metrics",
        include_in_schema=False,
    )
