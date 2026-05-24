#!/usr/bin/env python3
"""
Naija Creator Hub - Production Video Assembly & Editing Pipeline
================================================================
This script matches stock video clips to a voiceover script, synchronizes
the voiceover timeline, overlays CapCut-style animated word-by-word active 
highlight captions, and compiles them into a single high-fidelity MP4.

Requirements:
    pip install moviepy pillow numpy

Usage:
    python video_assembler.py --script "Script content..." --audio voiceover.wav --videos clip1.mp4 clip2.mp4 --orientation vertical --output output.mp4
"""

import os
import sys
import argparse
from PIL import Image, ImageDraw, ImageFont
import numpy as np

try:
    from moviepy.editor import VideoFileClip, AudioFileClip, concatenate_videoclips, CompositeVideoClip
except ImportError:
    print("[!] Python module 'moviepy' is not installed. Run: pip install moviepy")
    sys.exit(1)

def parse_args():
    parser = argparse.ArgumentParser(description="Naija Creator Hub Video Assembler")
    parser.add_argument("--script", type=str, required=True, help="Full text of the generated script")
    parser.add_argument("--audio", type=str, required=True, help="Path to the generated voiceover audio file (WAV/MP3)")
    parser.add_argument("--videos", nargs="+", required=True, help="List of file paths to the sourced stock video clips")
    parser.add_argument("--orientation", type=str, choices=["vertical", "horizontal"], default="vertical", help="Output format orientation")
    parser.add_argument("--output", type=str, default="final_output.mp4", help="Path to write the final compiled MP4 file")
    parser.add_argument("--font_size", type=int, default=50, help="Base size font for rendering captions")
    parser.add_argument("--highlight_color", type=str, default="#facc15", help="Hex color code for highlighted words (default: yellow)")
    return parser.parse_args()

def split_script_to_sentences(script_text):
    """Splits full script text into sentence segments."""
    import re
    # Split text by punctuation marks with clean spacing
    raw_sentences = re.split(r"(?<=[.!?])\s+|\n+", script_text)
    return [s.strip() for s in raw_sentences if len(s.strip()) > 3]

def generate_word_timestamps(sentences, total_audio_duration):
    """
    Synthesizes and calculates word-level timestamps character-proportionally
    over the total audio voiceover duration.
    """
    total_chars = sum(len(sentence) for sentence in sentences)
    segments = []
    elapsed_time = 0.0

    for i, sentence in enumerate(sentences):
        char_ratio = len(sentence) / max(1, total_chars)
        segment_duration = char_ratio * total_audio_duration
        start_time = elapsed_time
        end_time = elapsed_time + segment_duration
        elapsed_time = end_time

        # Generate word-level timing details
        words = sentence.split()
        words_total_chars = sum(len(w) for w in words)
        word_elapsed = start_time

        timed_words = []
        for word in words:
            word_ratio = len(word) / max(1, words_total_chars)
            word_duration = word_ratio * segment_duration
            word_start = word_elapsed
            word_end = word_elapsed + word_duration
            word_elapsed = word_end

            timed_words.append({
                "text": word,
                "start": word_start,
                "end": word_end
            })

        segments.append({
            "id": i,
            "text": sentence,
            "start": start_time,
            "end": end_time,
            "words": timed_words
        })

    return segments

def draw_caption_on_frame(frame, timestamp, active_segment, width, height, font_size, highlight_color):
    """
    Uses Pillow to dynamically draw CapCut-style dual-toned overlay 
    subtitles onto each raw video frame.
    """
    # Convert moviepy frame (numpy array) to Pillow Image
    img = Image.fromarray(frame)
    draw = ImageDraw.Draw(img)

    # Load font fallback
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except IOError:
        try:
            font = ImageFont.truetype("LiberationSans-Bold.ttf", font_size)
        except IOError:
            font = ImageFont.load_default()

    words = active_segment["words"]
    active_word = None
    for w in words:
        if w["start"] <= timestamp <= w["end"]:
            active_word = w
            break

    # CapCut Caption styling arrangement: wrap in rows of 5 words
    max_words_per_row = 5
    words_total = len(words)
    
    # Locate active index
    active_idx = -1
    if active_word:
        try:
            active_idx = words.index(active_word)
        except ValueError:
            pass

    row_index = max(0, active_idx // max_words_per_row) if active_idx != -1 else 0
    row_words = words[row_index * max_words_per_row:(row_index + 1) * max_words_per_row]

    # Compute horizontal spacing
    word_spacing = max_words_per_row * 3
    row_width = 0
    word_widths = []

    for word_obj in row_words:
        # Get width using textbbox
        bbox = draw.textbbox((0, 0), word_obj["text"], font=font)
        w_width = bbox[2] - bbox[0]
        word_widths.append(w_width)
        row_width += w_width

    row_width += word_spacing * (len(row_words) - 1)
    
    # Centered bottom placing
    cap_x = (width / 2) - (row_width / 2)
    cap_y = height * 0.82

    # Draw word strings in series
    current_x = cap_x
    for i, word_obj in enumerate(row_words):
        is_highlighted = (word_obj == active_word)
        color = highlight_color if is_highlighted else "#ffffff"
        txt = word_obj["text"]

        # Draw beautiful high-contrast dark border outlines (standard readable captions)
        border_offsets = [(-2, -2), (2, -2), (-2, 2), (2, 2), (-1, 0), (1, 0), (0, -1), (0, 1)]
        for offset_x, offset_y in border_offsets:
            draw.text((current_x + offset_x, cap_y + offset_y), txt, font=font, fill="#000000")

        # Draw primary fill content
        draw.text((current_x, cap_y), txt, font=font, fill=color)
        current_x += word_widths[i] + word_spacing

    return np.array(img)

def assemble_video():
    args = parse_args()

    print("[+] Naija Creator Hub Video Editor initialized.")
    print(f"[+] Orientation profile: {args.orientation.upper()}")

    # 1. Inspect and load core voiceover sound file
    if not os.path.exists(args.audio):
        print(f"[-] Voiceover audio path not found: {args.audio}")
        sys.exit(1)

    audio_clip = AudioFileClip(args.audio)
    total_duration = audio_clip.duration
    print(f"[+] Voiceover audio file loaded successfully. Play duration: {total_duration:.2f} seconds")

    # 2. Extract scripts sectors
    sentences = split_script_to_sentences(args.script)
    if not sentences:
        print("[-] Script content is empty or lacks valid structure.")
        sys.exit(1)
    print(f"[+] Synced script parsed into {len(sentences)} key narration scenes.")

    # 3. Formulate synchronous timeline mapping words characterized by timescale
    timeline = generate_word_timestamps(sentences, total_duration)

    # Set export bounds matching aspect standards
    width, height = (1080, 1920) if args.orientation == "vertical" else (1920, 1080)

    # 4. Lay and sync video sequences onto the timed segments
    scene_clips = []
    num_available_clips = len(args.videos)

    for i, segment in enumerate(timeline):
        s_start = segment["start"]
        s_end = segment["end"]
        duration = s_end - s_start

        # Fetch index corresponding loops safely
        video_path = args.videos[i % num_available_clips]
        if not os.path.exists(video_path):
            print(f"[-] Video asset file not found at: {video_path}")
            sys.exit(1)

        print(f"    -> Syncing Segment {i+1}/{len(timeline)}: '{segment['text'][:40]}...' to stock asset: {os.path.basename(video_path)}")

        try:
            # Resubmit to moviepy loading container
            clip = VideoFileClip(video_path)

            # Re-scale assets matching export aspect formats using cover cropping
            clip_ratio = clip.w / clip.h
            target_ratio = width / height

            if clip_ratio > target_ratio:
                # Clip is wider than target ratio: crop sides
                new_width = int(clip.h * target_ratio)
                cropped_clip = clip.crop(x1=(clip.w - new_width) // 2, width=new_width)
            else:
                # Clip is taller than target ratio: crop top/bottom
                new_height = int(clip.w / target_ratio)
                cropped_clip = clip.crop(y1=(clip.h - new_height) // 2, height=new_height)

            resized_clip = cropped_clip.resize((width, height))

            # Stretch, loop, or speed up clip if it is shorter than target duration segment
            if resized_clip.duration < duration:
                # Direct looping mapping segment duration limits
                loop_factor = int(np.ceil(duration / resized_clip.duration))
                from moviepy.video.fx.all import loop
                timed_clip = loop(resized_clip, n=loop_factor).subclip(0, duration)
            else:
                timed_clip = resized_clip.subclip(0, duration)

            # Apply dynamic caption overlays to video using Frame manipulation
            def caption_overlay_filter(get_frame, t):
                frame_at_t = get_frame(t)
                # Pass the global timeline coordinate (segment_start + frame_local_t) to get correct active word timing
                global_time = s_start + t
                return draw_caption_on_frame(
                    frame_at_t, 
                    global_time, 
                    segment, 
                    width, 
                    height, 
                    args.font_size, 
                    args.highlight_color
                )

            annotated_clip = timed_clip.fl(caption_overlay_filter)
            scene_clips.append(annotated_clip)

        except Exception as e:
            print(f"[-] Error loading video asset {video_path}: {e}")
            sys.exit(1)

    # 5. Concatenate video clips and bind the master audio timeline
    print("[+] Concatenating and packaging full timeline scenes...")
    assembled_film = concatenate_videoclips(scene_clips, method="compose")
    
    # Bundle voiceover audio overlay track
    final_film = assembled_film.set_audio(audio_clip)

    # 6. Save final file output
    print(f"[+] Rendering and exporting file onto {args.output}...")
    final_film.write_videofile(
        args.output,
        codec="libx264",
        audio_codec="aac",
        fps=30,
        preset="medium",
        threads=4
    )

    print(f"[+] SUCCESS! Your premium compiled video is ready: {args.output}")

if __name__ == "__main__":
    assemble_video()
