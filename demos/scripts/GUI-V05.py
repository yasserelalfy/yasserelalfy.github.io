# !pip install -r requirements.txt

import os
import glob
import csv
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
from PIL import Image, ImageTk
import cv2

class AnnotatorGUI:
    def __init__(self, master):
        self.master = master
        self.master.title("Dataset Annotator")
        
        # Variables to track dataset type, folder, file list, annotations, and feature settings
        self.dataset_type = tk.StringVar(value="Images")
        self.dataset_folder = ""
        self.file_list = []
        self.current_index = 0
        self.annotations = {}  # Mapping: file path -> list of feature values
        self.features = []     # List of feature names
        self.feature_vars = [] # tk.StringVar objects for each feature field
        self.feature_entries = []  # Widgets (ttk.Combobox) for each feature
        
        # For video playback controls
        self.video_cap = None
        self.playing = False
        self.delay = 30
        self.playback_speed = 1.0
        self.fps = 30
        self.total_frames = 0
        self.is_seeking = False
        self.after_id = None  # To store the `after` callback ID
        
        self.all_suggestions = {} # Store full list for filtering
        self.cb_width = tk.IntVar(value=35) # Configurable combobox width
        self.build_gui()
    
    def build_gui(self):
        # --- Top Frame: Dataset type selection, folder selection, and exit ---
        top_frame = tk.Frame(self.master)
        top_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)
        
        tk.Label(top_frame, text="Dataset Type:").pack(side=tk.LEFT)
        tk.Radiobutton(top_frame, text="Images", variable=self.dataset_type, value="Images").pack(side=tk.LEFT)
        tk.Radiobutton(top_frame, text="Videos", variable=self.dataset_type, value="Videos").pack(side=tk.LEFT)
        tk.Button(top_frame, text="Select Folder", command=self.select_folder).pack(side=tk.LEFT, padx=5)
        tk.Button(top_frame, text="Exit", command=self.master.quit).pack(side=tk.RIGHT, padx=5)
        
        # --- Main Frame: Left side for media display and controls; right side for annotations ---
        main_frame = tk.Frame(self.master)
        main_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
        # Left side: Media display area and control buttons below it
        left_frame = tk.Frame(main_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.display_label = tk.Label(left_frame)
        self.display_label.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
        controls_frame = tk.Frame(left_frame)
        controls_frame.pack(side=tk.TOP, fill=tk.X, pady=5)

        # Seeking Bar
        self.seek_var = tk.DoubleVar()
        self.seek_bar = tk.Scale(controls_frame, variable=self.seek_var, orient=tk.HORIZONTAL, showvalue=False, command=self.seek_video)
        self.seek_bar.pack(side=tk.TOP, fill=tk.X, padx=2, pady=2)
        self.seek_bar.bind("<ButtonPress-1>", self.on_seek_start)
        self.seek_bar.bind("<ButtonRelease-1>", self.on_seek_end)

        # Control Buttons Logic
        buttons_subframe = tk.Frame(controls_frame)
        buttons_subframe.pack(side=tk.TOP, fill=tk.X)

        tk.Button(buttons_subframe, text="Previous", command=self.prev_item).pack(side=tk.LEFT, padx=2)
        tk.Button(buttons_subframe, text="Next", command=self.next_item).pack(side=tk.LEFT, padx=2)
        tk.Button(buttons_subframe, text="Previous Unannotated", command=self.prev_unannotated).pack(side=tk.LEFT, padx=2)
        tk.Button(buttons_subframe, text="Next Unannotated", command=self.next_unannotated).pack(side=tk.LEFT, padx=2)
        self.play_button = tk.Button(buttons_subframe, text="Play", command=self.play_video, state=tk.DISABLED)
        self.play_button.pack(side=tk.LEFT, padx=2)
        self.pause_button = tk.Button(buttons_subframe, text="Pause", command=self.pause_video, state=tk.DISABLED)
        self.pause_button.pack(side=tk.LEFT, padx=2)
        self.speed_up_button = tk.Button(buttons_subframe, text="Speed Up", command=self.speed_up, state=tk.DISABLED)
        self.speed_up_button.pack(side=tk.LEFT, padx=2)
        self.slow_down_button = tk.Button(buttons_subframe, text="Slow Down", command=self.slow_down, state=tk.DISABLED)
        self.slow_down_button.pack(side=tk.LEFT, padx=2)
        
        # Right side: Annotation panel with scrollable feature grid and feature configuration buttons
        self.annotation_frame = tk.Frame(main_frame, bd=2, relief=tk.GROOVE)
        # Change expand to False and fill to Y to allow it to grow horizontally as needed
        self.annotation_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=5, pady=5)
        self.build_annotation_panel()
    
    def build_annotation_panel(self):
        # Clear any existing widgets in the annotation frame
        for widget in self.annotation_frame.winfo_children():
            widget.destroy()
        
        # Header with title and file info
        header_frame = tk.Frame(self.annotation_frame)
        header_frame.pack(side=tk.TOP, fill=tk.X)
        tk.Label(header_frame, text="Annotations", font=("Arial", 14)).pack(side=tk.LEFT, padx=5, pady=5)
        self.file_info_label = tk.Label(header_frame, text="No file loaded")
        self.file_info_label.pack(side=tk.LEFT, padx=5, pady=5)
        
        # Main content: a frame that holds the scrollable feature grid and the feature add/remove buttons
        content_frame = tk.Frame(self.annotation_frame)
        content_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create a canvas for scrolling
        canvas = tk.Canvas(content_frame)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Add vertical scrollbar to the canvas
        scrollbar = tk.Scrollbar(content_frame, orient=tk.VERTICAL, command=canvas.yview)
        scrollbar.pack(side=tk.LEFT, fill=tk.Y)
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Create a frame inside the canvas to hold the feature grid
        features_frame = tk.Frame(canvas)
        canvas.create_window((0,0), window=features_frame, anchor="nw")
        
        # Update scroll region when the inner frame resizes
        def on_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))
        features_frame.bind("<Configure>", on_configure)
        
        # Build grid of features (each row: Label and Combobox)
        self.feature_vars = []
        self.feature_entries = []
        for r, feature in enumerate(self.features):
            tk.Label(features_frame, text=feature).grid(row=r, column=0, padx=5, pady=2, sticky="w")
            var = tk.StringVar()
            self.feature_vars.append(var)
            combobox = ttk.Combobox(features_frame, textvariable=var, width=self.cb_width.get())
            combobox.grid(row=r, column=1, padx=5, pady=2, sticky="ew")
            # Bind event for filtering suggestions
            combobox.bind('<KeyRelease>', lambda e, cb=combobox, feat=feature: self.on_combobox_keyrelease(e, cb, feat))
            # Restore full list only after a selection is made
            combobox.bind('<<ComboboxSelected>>', lambda e, cb=combobox, feat=feature: self.restore_full_suggestions(e, cb, feat))
            self.feature_entries.append(combobox)
            features_frame.columnconfigure(1, weight=1)
        
        # Force layout calculation to get the required width of the features
        features_frame.update_idletasks()
        canvas.configure(width=features_frame.winfo_reqwidth())
        
        # Feature configuration buttons and Width control
        buttons_frame = tk.Frame(content_frame)
        buttons_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)
        tk.Button(buttons_frame, text="Add Feature", command=self.add_feature).pack(pady=2)
        tk.Button(buttons_frame, text="Remove Feature", command=self.remove_feature).pack(pady=2)
        
        tk.Label(buttons_frame, text="Field Width:").pack(pady=(10, 0))
        width_spin = tk.Spinbox(buttons_frame, from_=10, to=100, textvariable=self.cb_width, width=5, command=self.update_ui_on_width_change)
        width_spin.pack(pady=2)
        width_spin.bind("<Return>", lambda e: self.update_ui_on_width_change())

        # Save Annotation button below everything in the annotation panel
        tk.Button(self.annotation_frame, text="Save Annotation", command=self.save_annotation).pack(pady=5)
    
    def update_ui_on_width_change(self):
        """Update the annotation panel and resize window when width is changed."""
        self.build_annotation_panel()
        self.show_item()
        # Refresh the layout and snap the window to its new required size
        self.master.update_idletasks()
        self.master.geometry("")
    
    def select_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.dataset_folder = folder
            self.load_dataset()
            self.load_csv()  # Check for existing CSV and load if found
            self.current_index = 0
            self.show_item()
    
    def load_dataset(self):
        # List files recursively based on dataset type
        self.file_list = []
        if self.dataset_type.get() == "Images":
            extensions = ('*.png', '*.jpg', '*.jpeg', '*.bmp', '*.gif')
        else:  # Videos
            extensions = ('*.mp4', '*.avi', '*.mkv', '*.mov')
        for ext in extensions:
            self.file_list.extend(glob.glob(os.path.join(self.dataset_folder, '**', ext), recursive=True))
        self.file_list.sort()
        if not self.file_list:
            messagebox.showwarning("Warning", "No files found for the selected type.")
        
        # Initialize annotations for files not yet annotated
        for f in self.file_list:
            if f not in self.annotations:
                self.annotations[f] = [""] * len(self.features)
    
    def get_csv_path(self):
        # CSV file is created inside the dataset folder with the same basename as the folder
        folder_name = os.path.basename(self.dataset_folder)
        csv_path = os.path.join(self.dataset_folder, folder_name + ".csv")
        return csv_path
    
    def load_csv(self):
        csv_path = self.get_csv_path()
        if os.path.exists(csv_path):
            # Load CSV and update the annotations and feature names
            with open(csv_path, newline='', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                fieldnames = reader.fieldnames
                if fieldnames:
                    # Assume first five fields are file info; remaining are feature names
                    self.features = fieldnames[5:]
                    for row in reader:
                        file_path = row["Full Path"]
                        self.annotations[file_path] = [row[feat] for feat in self.features]
            self.build_annotation_panel()
        else:
            # If no CSV exists, start with an empty feature list (user can add features)
            self.features = []
            self.build_annotation_panel()
        
        self.update_video_controls()
            
    def save_csv(self):
        csv_path = self.get_csv_path()
        folder_name = os.path.basename(self.dataset_folder)
        fieldnames = ["File", "File Name", "File Extension", "Full Path", "Relative Path"] + self.features
        with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            for f in self.file_list:
                data = {"File": os.path.basename(f), 
                        "File Name": os.path.basename(f)[:-4], 
                        "File Extension": os.path.basename(f)[-4:], 
                        "Full Path": f, 
                        "Relative Path": f.replace(self.dataset_folder, folder_name)}
                ann = self.annotations.get(f, [""] * len(self.features))
                for i, feat in enumerate(self.features):
                    data[feat] = ann[i] if i < len(ann) else ""
                writer.writerow(data)

    def save_annotation(self):
        if not self.file_list:
            return
        current_file = self.file_list[self.current_index]
        values = [var.get() for var in self.feature_vars]
        self.annotations[current_file] = values
        self.save_csv()
    
    def show_item(self):
        if not self.file_list:
            return
        
        current_file = self.file_list[self.current_index]
        self.file_info_label.config(text=f"{os.path.basename(current_file)}")
       
        if self.dataset_type.get() == "Images":
            self.show_image(current_file)
        else:
            self.show_video(current_file)
        
        # Load saved annotation values (if any) into the feature fields
        ann = self.annotations.get(current_file, [""] * len(self.features))
        for var, value in zip(self.feature_vars, ann):
            var.set(value)
        self.update_feature_suggestions()
    
    def show_image(self, file_path):
        # If a video capture is active, release it
        if self.video_cap:
            self.video_cap.release()
            self.video_cap = None
        try:
            img = Image.open(file_path)
            img.thumbnail((400, 400))
            self.photo = ImageTk.PhotoImage(img)
            self.display_label.config(image=self.photo)
        except Exception as e:
            messagebox.showerror("Error", f"Unable to open image:\n{e}")
    
    def show_video(self, file_path):
        # Stop any previous video
        self.pause_video()  # Ensure any scheduled updates are cancelled
        if self.video_cap:
            self.video_cap.release()
        self.video_cap = cv2.VideoCapture(file_path)
        self.playing = False
        
        # Get video properties
        self.fps = self.video_cap.get(cv2.CAP_PROP_FPS)
        if self.fps <= 0: self.fps = 30
        self.total_frames = int(self.video_cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Configure seeking bar
        self.seek_bar.config(from_=0, to=self.total_frames)
        self.seek_var.set(0)
        self.playback_speed = 1.0

        self.update_video_controls()
        ret, frame = self.video_cap.read()
        if ret:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(frame).resize((400, 400))
            self.photo = ImageTk.PhotoImage(img)
            self.display_label.config(image=self.photo)
        else:
            messagebox.showerror("Error", "Cannot read video.")
    
    def update_video_controls(self):
        # Enable video controls only if the dataset type is Videos
        if self.dataset_type.get() == "Videos":
            self.play_button.config(state=tk.NORMAL)
            self.pause_button.config(state=tk.NORMAL)
            self.speed_up_button.config(state=tk.NORMAL)
            self.slow_down_button.config(state=tk.NORMAL)
        else:
            self.play_button.config(state=tk.DISABLED)
            self.pause_button.config(state=tk.DISABLED)
            self.speed_up_button.config(state=tk.DISABLED)
            self.slow_down_button.config(state=tk.DISABLED)
    
    def play_video(self):
        if self.dataset_type.get() != "Videos" or not self.video_cap:
            return
        self.playing = True
        self.play_frames()
    
    def play_frames(self):
        if self.playing and self.video_cap:
            if self.is_seeking:
                self.after_id = self.master.after(100, self.play_frames)
                return

            ret, frame = self.video_cap.read()
            if ret:
                # Update slider if not seeking
                current_frame = self.video_cap.get(cv2.CAP_PROP_POS_FRAMES)
                self.seek_var.set(current_frame)

                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(frame).resize((400, 400))
                self.photo = ImageTk.PhotoImage(img)
                self.display_label.config(image=self.photo)
                
                delay = int(1000 / (self.fps * self.playback_speed))
                self.after_id = self.master.after(max(1, delay), self.play_frames)
            else:
                # If video ends, reset to beginning
                self.video_cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                self.seek_var.set(0)
                delay = int(1000 / (self.fps * self.playback_speed))
                self.after_id = self.master.after(max(1, delay), self.play_frames)
    
    def pause_video(self):
        self.playing = False
        if self.after_id:
            self.master.after_cancel(self.after_id)
            self.after_id = None
    
    def speed_up(self):
        self.playback_speed = min(15.0, self.playback_speed + 1)
    
    def slow_down(self):
        self.playback_speed = max(0.25, self.playback_speed - 1)
        
    def on_seek_start(self, event):
        self.is_seeking = True

    def on_seek_end(self, event):
        self.is_seeking = False
        # The scale command callback handles the frame set
        
    def seek_video(self, value):
        if not self.video_cap: return
        frame_no = float(value)
        self.video_cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
        
        # If paused, update the frame visualization immediately
        if not self.playing:
            ret, frame = self.video_cap.read()
            if ret:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(frame).resize((400, 400))
                self.photo = ImageTk.PhotoImage(img)
                self.display_label.config(image=self.photo)
            # Reset position so play continues matches the visual
            self.video_cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
    
    def prev_item(self):
        self.pause_video()
        if self.current_index > 0:
            self.current_index -= 1
            self.show_item()
            self.playback_speed = 1.0
            self.play_video()
    
    def next_item(self):
        self.pause_video()
        if self.current_index < len(self.file_list) - 1:
            self.current_index += 1
            self.show_item()
            self.playback_speed = 1.0
            self.play_video()
            
    def is_unannotated(self, file_path):
        """Check if a file has any missing annotations (empty cells)."""
        ann = self.annotations.get(file_path, [])
        if not ann or len(ann) < len(self.features):
            return True
        return any(val == "" for val in ann)

    def prev_unannotated(self):
        """Move to the previous sample that has missing annotations."""
        if not self.file_list:
            return
        
        self.pause_video()
        # Search backwards from the index just before current_index
        for i in range(self.current_index - 1, -1, -1):
            if self.is_unannotated(self.file_list[i]):
                self.current_index = i
                self.show_item()
                self.playback_speed = 1.0
                self.play_video()
                return
        messagebox.showinfo("Info", "No more previous unannotated samples.")

    def next_unannotated(self):
        """Move to the next sample that has missing annotations."""
        if not self.file_list:
            return
        
        self.pause_video()
        # Search forwards from the index just after current_index
        for i in range(self.current_index + 1, len(self.file_list)):
            if self.is_unannotated(self.file_list[i]):
                self.current_index = i
                self.show_item()
                self.playback_speed = 1.0
                self.play_video()
                return
        messagebox.showinfo("Info", "No more next unannotated samples.")
    
    def add_feature(self):
        # Ask the user for a new feature name and add it
        new_feature = simpledialog.askstring("Add Feature", "Enter feature name:")
        if new_feature:
            self.features.append(new_feature)
            # Update annotations for all files by appending an empty value for the new feature
            for f in self.file_list:
                if f in self.annotations:
                    self.annotations[f].append("")
                else:
                    self.annotations[f] = [""] * len(self.features)
            self.build_annotation_panel()
            self.show_item()
    
    def remove_feature(self):
        # Remove the last feature if one exists
        if self.features:
            self.features.pop()
            for f in self.file_list:
                if f in self.annotations and self.annotations[f]:
                    self.annotations[f].pop()
            self.build_annotation_panel()
            self.show_item()
    
    def update_feature_suggestions(self):
        # Gather unique previous values for each feature to suggest in the dropdown menus
        suggestions = {feat: set() for feat in self.features}
        for ann in self.annotations.values():
            for i, val in enumerate(ann):
                if i < len(self.features) and val:
                    suggestions[self.features[i]].add(val)
        
        self.all_suggestions = {feat: sorted(list(vals)) for feat, vals in suggestions.items()}
        
        for i, combobox in enumerate(self.feature_entries):
            feat = self.features[i]
            combobox['values'] = self.all_suggestions.get(feat, [])

    def on_combobox_keyrelease(self, event, combobox, feature):
        """Filter the combobox values based on user input."""
        # Ignore navigation and control keys
        ignored_keys = ('Up', 'Down', 'Left', 'Right', 'Return', 'Escape', 'Tab', 
                        'Shift_L', 'Shift_R', 'Control_L', 'Control_R', 
                        'Alt_L', 'Alt_R', 'Meta_L', 'Meta_R', 'Next', 'Prior')
        if event.keysym in ignored_keys:
            return

        typed_text = combobox.get().lower()
        full_list = self.all_suggestions.get(feature, [])
        
        if typed_text == "":
            filtered_values = full_list
        else:
            filtered_values = [v for v in full_list if typed_text in v.lower()]
        
        combobox['values'] = filtered_values
        
        # Open the dropdown menu non-intrusively if there are matches
        if filtered_values:
            try:
                # Use Tcl/Tk 'post' command to open the dropdown without side effects
                self.master.tk.call(combobox._w, "post")
            except Exception:
                pass 
            
            # Keep focus on the combobox so the user can continue typing
            combobox.focus_set()

    def restore_full_suggestions(self, event, combobox, feature):
        """Restore all suggestions after a selection or when needed."""
        combobox['values'] = self.all_suggestions.get(feature, [])

if __name__ == "__main__":
    root = tk.Tk()
    app = AnnotatorGUI(root)
    root.mainloop()
