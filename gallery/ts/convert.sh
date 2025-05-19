#!/bin/bash

# Loop through all .ts files in the current directory
for file in *.ts; do
  # Check if the file exists
  if [ -f "$file" ]; then
    # Create a new file with the same name but with the .txt extension
    new_file="${file%.ts}.txt"
    # Copy the contents of the .ts file to the .txt file
    cp "$file" "$new_file"
    echo "Copied $file to $new_file"
  else
    echo "File $file not found"
  fi
done

