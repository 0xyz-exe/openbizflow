import ipaddress
import socket
from urllib.parse import urlparse
from app.core.config import settings

BLOCKED_CIDRS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

def validate_url_safe(url: str) -> None:
    """
    Validates that a URL does not target loopback, private networks, or metadata services.
    Raises ValueError if URL is unsafe.
    """
    if settings.ALLOW_PRIVATE_IPS:
        return

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme}. Only HTTP/HTTPS are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: missing hostname")

    # Check for direct IP or resolve DNS
    try:
        resolved_ips = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise ValueError(f"DNS resolution failed for hostname '{hostname}': {str(e)}")

    for item in resolved_ips:
        ip_str = item[4][0]
        ip_obj = ipaddress.ip_address(ip_str)
        for cidr in BLOCKED_CIDRS:
            if ip_obj in cidr:
                raise ValueError(
                    f"SSRF Protection: Access to private/internal IP {ip_str} ({hostname}) is forbidden."
                )
