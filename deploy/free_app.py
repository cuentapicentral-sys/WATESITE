from backend.main import app
from services.analytics.main import app as analytics_app
from services.citizens.main import app as citizens_app
from services.containers.main import app as containers_app
from services.fleet.main import app as fleet_app
from services.notifications.main import app as notifications_app
from services.reporting.main import app as reporting_app
from services.routes.main import app as routes_app
from services.sensors.main import app as sensors_app

app.mount("/services/containers", containers_app)
app.mount("/services/routes", routes_app)
app.mount("/services/fleet", fleet_app)
app.mount("/services/citizens", citizens_app)
app.mount("/services/sensors", sensors_app)
app.mount("/services/reporting", reporting_app)
app.mount("/services/notifications", notifications_app)
app.mount("/services/analytics", analytics_app)
