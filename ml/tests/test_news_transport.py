import io
import json
from urllib.error import HTTPError

from corridor_ml import news


def test_conditional_requests_and_failure_are_incremental(monkeypatch, tmp_path):
    config, database = tmp_path / "feeds.json", tmp_path / "news.sqlite"
    config.write_text(json.dumps({"feeds": ["https://publisher.example/feed"]}))
    monkeypatch.setattr(news, "public_feed_url", lambda v: v)
    raw = b'<rss><channel><item><title>Test headline</title><link>https://publisher.example/article</link></item></channel></rss>'
    requests = []

    class Response(io.BytesIO):
        headers = {"ETag": '"version-1"', "Last-Modified": "Mon, 01 Jun 2026 12:00:00 GMT"}

    class Opener:
        def open(self, request, timeout):
            requests.append(request)
            if len(requests) == 1:
                return Response(raw)
            if len(requests) == 2:
                assert request.get_header("If-none-match") == '"version-1"'
                assert request.get_header("If-modified-since")
                raise HTTPError(request.full_url, 304, "Not modified", {}, None)
            raise HTTPError(request.full_url, 503, "Unavailable", {}, None)

    monkeypatch.setattr(news, "build_opener", lambda *args: Opener())
    assert news.fetch_news(config, database)[0]["new_articles"] == 1
    assert news.fetch_news(config, database)[0]["unchanged"] is True
    assert "error" in news.fetch_news(config, database)[0]
    with news.connect(database) as db:
        assert db.execute("SELECT COUNT(*) FROM articles").fetchone()[0] == 1
        assert db.execute("SELECT status FROM articles").fetchone()[0] == "unreviewed"
        assert "503" in db.execute("SELECT last_error FROM feeds").fetchone()[0]
