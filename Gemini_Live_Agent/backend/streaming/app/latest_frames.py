from dataclasses import dataclass, field


@dataclass
class FrameData:
    image: bytes
    selection: dict | None = None  # {x, y, width, height} normalized 0-1


# Module-level store for the latest document frame per session
latest_frames: dict[str, FrameData] = {}
