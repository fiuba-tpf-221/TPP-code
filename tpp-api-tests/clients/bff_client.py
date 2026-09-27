import httpx


class BffClient:

    def __init__(self, base_url: str):
        self.client = httpx.Client(
            base_url=base_url,
            timeout=10,
        )

    def login(
        self,
        email: str,
        password: str,
    ) -> httpx.Response:

        return self.client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": password,
            },
        )

    def raw_login(
        self,
        body,
    ) -> httpx.Response:

        return self.client.post(
            "/api/v1/auth/login",
            json=body,
        )

    def close(self):
        self.client.close()