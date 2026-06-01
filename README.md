# AI-Powered Touchless Computer Control System

## Overview

AI-Powered Touchless Computer Control System is a real-time hand gesture recognition project built using HTML, CSS, JavaScript, and MediaPipe Hands. The system allows users to interact with a computer without using a physical mouse or keyboard.

Using a webcam, the application detects hand landmarks and recognizes gestures such as pinch, open hand, fist, thumbs up, and swipe gestures. These gestures can be mapped to various computer actions including cursor movement, clicking, scrolling, presentation control, volume control, and virtual drawing.

---

## Problem Statement

Traditional computer interaction relies heavily on physical devices such as keyboards, mice, and touchscreens. In environments like hospitals, classrooms, industries, and public kiosks, touch-based interaction may be inconvenient, unsafe, or inaccessible.

This project provides a touchless human-computer interaction system using computer vision and hand gesture recognition.

---

## Objectives

* Detect human hands in real time using a webcam.
* Track 21 hand landmarks using MediaPipe.
* Recognize common hand gestures.
* Enable touchless interaction with computers.
* Provide a foundation for smart classroom and healthcare applications.

---

## Features

### Hand Tracking

* Real-time hand detection
* 21 landmark tracking
* Single and dual hand support

### Gesture Recognition

* Open Hand Detection
* Fist Detection
* Pinch Detection
* Thumbs Up Detection
* Victory Sign Detection

### Visual Effects

* Neon hand skeleton
* Particle effects
* Energy connections between hands
* Dynamic themes
* Motion trails

### Audio Effects

* Ambient sound effects
* Gesture-triggered audio feedback

### User Interface

* Live gesture display
* FPS counter
* Hand detection status
* Theme selection panel

---

## Technology Stack

### Frontend

* HTML5
* CSS3
* JavaScript (ES6)

### Computer Vision

* MediaPipe Hands

### Graphics

* Canvas API

### Audio

* Web Audio API

---

## System Architecture

Webcam
↓
MediaPipe Hands
↓
Hand Landmark Detection
↓
Gesture Recognition Engine
↓
Action Processing
↓
Visual & Audio Feedback

---

## Hand Landmarks

The system uses 21 hand landmarks provided by MediaPipe Hands.

Important points:

* Thumb Tip → Landmark 4
* Index Tip → Landmark 8
* Middle Tip → Landmark 12
* Ring Tip → Landmark 16
* Pinky Tip → Landmark 20

---

## Gesture Detection Logic

### Pinch Gesture

Thumb Tip + Index Tip

If the distance between both landmarks is below a threshold value, a pinch gesture is detected.

### Open Hand

Distance between fingers is large.

### Fist

Distance between fingers is small.

---

## Project Structure

project/

│

├── index.html

├── style.css

├── script.js

├── assets/

│ ├── images/

│ └── sounds/

│

└── README.md

---

## Future Enhancements

### Virtual Mouse

* Cursor movement
* Left click
* Right click

### Presentation Control

* Next slide
* Previous slide
* Start slideshow

### Virtual Whiteboard

* Air drawing
* Gesture-based controls

### Smart Classroom

* Touchless teaching system
* Interactive presentations

### Healthcare System

* Touchless medical screen navigation
* Reduced infection risk

### AI Gesture Classification

* TensorFlow.js integration
* Custom gesture training

---

## Applications

### Education

* Smart classrooms
* Interactive learning

### Healthcare

* Touchless medical systems

### Industry

* Machine control using gestures

### Accessibility

* Assistive technology for physically challenged users

---

## Advantages

* Contactless interaction
* Real-time performance
* Easy deployment
* Cross-platform support
* Improved accessibility

---

## Future Scope

The project can be extended into a complete AI-powered touchless operating system interface using advanced gesture recognition, machine learning models, and augmented reality technologies.

---

## Author

Rohit Buddhe

Computer Engineering Student

AI-Powered Touchless Computer Control System
