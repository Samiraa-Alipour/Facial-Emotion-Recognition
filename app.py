from flask import Flask, render_template, Response, jsonify, request
import cv2
import mediapipe as mp
import numpy as np
from PIL import Image
import io
import base64
import os
import time
import tempfile

from flask import Flask, send_from_directory
# app = Flask(__name__)
app = Flask(__name__, static_folder='static')

# Initialize MediaPipe Face Detection
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

# Function to create a FaceMesh instance with specified max_num_faces
def create_face_mesh(max_num_faces):
    return mp_face_mesh.FaceMesh(
        max_num_faces=max_num_faces,
        refine_landmarks=True,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.7
    )

# Initialize face mesh for real-time and video processing (1 face)
face_mesh_realtime = create_face_mesh(1)

# Function to calculate aspect ratio of facial features
def calculate_aspect_ratio(landmarks, points):
    height = abs(landmarks[points[1]][1] - landmarks[points[0]][1])
    width = abs(landmarks[points[3]][0] - landmarks[points[2]][0])
    return height / (width + 1e-6)


# Function to detect emotions based on facial landmarks
def detect_emotion(face_landmarks, face_image):
    landmarks = np.array([(lm.x, lm.y, lm.z) for lm in face_landmarks.landmark])
    mouth_ratio = calculate_aspect_ratio(landmarks, [13, 14, 78, 308])
    left_eye_ratio = calculate_aspect_ratio(landmarks, [159, 145, 33, 133])
    right_eye_ratio = calculate_aspect_ratio(landmarks, [386, 374, 362, 263])
    eye_ratio = (left_eye_ratio + right_eye_ratio) / 2

    emotions = {
        'Happy': 0.0,
        'Sad': 0.0,
        'Angry': 0.0,
        'Surprised': 0.0,
        'Neutral': 0.0
    }

    if mouth_ratio > 0.3 and eye_ratio > 0.25:
        emotions['Surprised'] = 0.85
    elif mouth_ratio > 0.1:
        emotions['Happy'] = 0.9
    elif eye_ratio < 0.2:
        emotions['Angry'] = 0.8
    elif mouth_ratio < -0.02:
        emotions['Sad'] = 0.75
    else:
        emotions['Neutral'] = 0.7

    dominant_emotion = max(emotions.items(), key=lambda x: x[1])
    return emotions, dominant_emotion[0]




# Function to process each frame based on the mode
def process_frame(frame, mode='realtime'):
    if frame is None:
        return None, None

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Choose face mesh based on mode
    if mode in ['realtime', 'video']:
        results = face_mesh_realtime.process(rgb_frame)
    else: # For image upload mode
        face_mesh_image = create_face_mesh(4) # Max faces set to 4 for image upload mode
        results = face_mesh_image.process(rgb_frame)

    frame = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR)

    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            mp_drawing.draw_landmarks(
                image=frame,
                landmark_list=face_landmarks,
                connections=mp_face_mesh.FACEMESH_TESSELATION,
                landmark_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=1),
                connection_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=1)
            )
            emotions, dominant_emotion = detect_emotion(face_landmarks, frame)
            frame = draw_emotion_box(frame, dominant_emotion)
            return frame, emotions

    return frame, None

def draw_emotion_box(image, emotion):
    height, width = image.shape[:2]
    overlay = image.copy()
    
    text = f"Emotion: {emotion}"
    font = cv2.FONT_HERSHEY_DUPLEX
    font_scale = 1.8 if emotion else 1.5 # Adjust font size based on emotion presence
    thickness = 3 if emotion else 2 
    position = (40, 100)

    (text_width, text_height), _ = cv2.getTextSize(text, font, font_scale, thickness)
    padding = 18
    
    start_point = (position[0] - padding, position[1] - text_height - padding)
    end_point = (position[0] + text_width + padding, position[1] + padding)

    color_map = {
        'Happy': (0, 255, 0),
        'Sad': (255, 0, 0),
        'Angry': (0, 0, 255),
        'Surprised': (255, 255, 0),
        'Neutral': (128, 128, 128)
    }
    
    box_color = color_map.get(emotion, (64, 64, 64)) 
    cv2.rectangle(overlay, start_point, end_point, box_color, -1)

    alpha = 0.85
    image = cv2.addWeighted(overlay, alpha, image, 1 - alpha, 0)

    cv2.putText(image,text,
                position,
                font,font_scale,(255 ,255 ,255), thickness)
    
    return image


def gen_frames():
    camera = cv2.VideoCapture(0)
    
    while True:
        success , frame = camera.read()
        
        if not success:
            break
        
        processed_frame , _ = process_frame(frame) # Default is real-time processing
        
        ret , buffer = cv2.imencode('.jpg', processed_frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    
    camera.release()

@app.route('/')
def index():
    return render_template('index.html')




@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')



# @app.route('/process_video', methods=['POST'])
# def process_video():
#    try:
#        file = request.files['file']
#        temp_path = 'temp_video.mp4'
#        file.save(temp_path)
       
#        # Process video frames
#        cap = cv2.VideoCapture(temp_path)
#        fps = int(cap.get(cv2.CAP_PROP_FPS))
#        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
#        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
       
#        # Ensure output directory exists
#        output_dir = os.path.join('static', 'processed_videos')
#        os.makedirs(output_dir, exist_ok=True)
       
#        # Create unique filename
#        output_path = os.path.join(output_dir, f'processed_{int(time.time())}.mp4')
       
#        # Create video writer with proper codec
#        fourcc = cv2.VideoWriter_fourcc(*'avc1')  
#        out = cv2.VideoWriter(output_path,fourcc,fps,(width,height))
       
#        emotions_timeline = []
       
#        while cap.isOpened():
#            ret , frame = cap.read()
#            if not ret:
#                break
                
#            processed_frame , emotions = process_frame(frame)
#            if emotions:
#                emotions_timeline.append(emotions)
           
#            out.write(processed_frame)

#        cap.release()
#        out.release()
#        os.remove(temp_path)
       
#        # Return relative path for frontend
#        relative_path=os.path.join('processed_videos',os.path.basename(output_path))
       
#        return jsonify({
#            'status':'success',
#            'video_path':relative_path,
#            'emotions_timeline':emotions_timeline
#        })
#    except Exception as e:
#        if os.path.exists(temp_path):
#            os.remove(temp_path)
#        return jsonify({'status':'error','message':str(e)})


@app.route('/process_video', methods=['POST'])
def process_video():
    temp_path = None  # Initialize temp_path to avoid reference before assignment
    try:
        file = request.files['file']
        
        # Create a temporary file to save the uploaded video
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name

        # Process video frames
        cap = cv2.VideoCapture(temp_path)
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Ensure output directory exists
        output_dir = os.path.join(app.root_path, 'static', 'processed_videos')
        os.makedirs(output_dir, exist_ok=True)

        # Create unique filename for processed video
        output_path = os.path.join(output_dir, f'processed_{int(time.time())}.mp4')

        # Create video writer with proper codec
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        emotions_timeline = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            processed_frame, emotions = process_frame(frame)  # Assuming process_frame is defined elsewhere
            if emotions:
                emotions_timeline.append(emotions)

            out.write(processed_frame)

        cap.release()
        out.release()

        # Delete the temporary file
        os.unlink(temp_path)

        # Return relative path for frontend
        relative_path = os.path.join('processed_videos', os.path.basename(output_path))

        return jsonify({
            'status': 'success',
            'video_path': relative_path,
            'emotions_timeline': emotions_timeline
        })
    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)  # Ensure temp file is deleted on error
        return jsonify({'status': 'error', 'message': str(e)})



@app.route('/process_image', methods=['POST'])
def process_image():
   try:
       file=request.files['file']
       img=Image.open(file.stream)
       opencv_img=cv2.cvtColor(np.array(img),cv2.COLOR_RGB2BGR)

       # Process the image with max_num_faces set to 4
       processed_frame , emotions=process_frame(opencv_img , mode='image')
       
       _, buffer=cv2.imencode('.jpg', processed_frame)
       processed_image=base64.b64encode(buffer).decode('utf-8')
       
       return jsonify({
           'status':'success',
           'image':processed_image,
           'emotions':emotions if emotions else {}
       })
   except Exception as e:
       return jsonify({'status':'error','message':str(e)})

if __name__ == '__main__':
#    app.run(debug=True)
#    app.run(host='0.0.0.0', port=os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))