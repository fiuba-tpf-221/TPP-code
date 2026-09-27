import httpx


class ProfileAuthClient:

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
            "/internal/v1/auth/login",
            json={
                "email": email,
                "password": password,
            },
        )

    def close(self):
        self.client.close()