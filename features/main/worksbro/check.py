import re
import json
import sys
import os
import glob
import time

def parse_log_to_json(log_content):
    """
    Parse log content and convert it to a structured JSON format.
    
    Args:
        log_content (str): The content of the log file
        
    Returns:
        dict: Structured JSON with agent conversations
    """
    # Split by lines for processing
    lines = log_content.split('\n')
    
    # Pattern to detect agent headers
    header_pattern = re.compile(r'output: "---------- (?:TextMessage|MultiModalMessage) \(([^)]+)\) ----------"')
    
    messages = []
    current_agent = None
    current_output = []
    meta_info = []
    
    for i, line in enumerate(lines):
        # Check if line is a header indicating a new agent
        header_match = header_pattern.search(line)
        
        if header_match:
            # If we were collecting output for a previous agent, save it
            if current_agent is not None and (current_output or meta_info):
                messages.append({
                    "agent_name": current_agent,
                    "agent_output": '\n'.join(current_output) if current_output else "",
                    "meta": '\n'.join(meta_info) if meta_info else None
                })
                
            # Set the new current agent
            current_agent = header_match.group(1)
            current_output = []
            meta_info = []
            continue
        
        # Check if line contains agent info
        if line.strip().startswith('agent: "'):
            # Add to meta if there's content but not an empty agent line
            if not line.strip() == 'agent: ""':
                meta_info.append(line.strip())
            continue
            
        # Check if line contains output
        if line.strip().startswith('output: "'):
            # Extract the actual output text, removing the 'output: "' prefix and '"' suffix
            # Handle both regular lines and potential escaped quotes
            content = line[len('output: "'):]
            if content.endswith('"'):
                content = content[:-1]
            
            # Skip header lines that were already processed
            if '---------- ' in content and ' ----------"' in line:
                continue
                
            # Add the content to the appropriate collection
            current_output.append(content)
    
    # Add the last agent's data if available
    if current_agent is not None and (current_output or meta_info):
        messages.append({
            "agent_name": current_agent,
            "agent_output": '\n'.join(current_output) if current_output else "",
            "meta": '\n'.join(meta_info) if meta_info else None
        })
    
    # Create the final JSON
    result = {"messages": messages}
    
    return result

def find_log_file(directory=None):
    """
    Find the most recent log file in the specified directory.
    If no directory is specified, use the current directory.
    
    Returns:
        str: Path to the log file, or None if not found
    """
    if directory is None:
        # Use the directory where the script is located
        directory = os.path.dirname(os.path.abspath(__file__))
        if not directory:  # If the script is run directly from the directory
            directory = "."
    
    # Look for .log or .txt files in the directory
    log_files = glob.glob(os.path.join(directory, "*.log")) + glob.glob(os.path.join(directory, "*.txt"))
    
    if not log_files:
        return None
    
    # Return the most recently modified log file
    return max(log_files, key=os.path.getmtime)

def get_json_output_path(log_file_path):
    """
    Generate a JSON output path based on the log file path.
    
    Args:
        log_file_path (str): Path to the log file
        
    Returns:
        str: Path to the JSON output file
    """
    # Use the same directory as the log file
    directory = os.path.dirname(os.path.abspath(log_file_path))
    
    # Use the log file name but with .json extension
    base_name = os.path.splitext(os.path.basename(log_file_path))[0]
    return os.path.join(directory, f"{base_name}.json")

def process_log_file(log_file_path, json_output_path):
    """Process the log file and update the JSON output"""
    try:
        # Read the log file
        with open(log_file_path, 'r', encoding='utf-8') as file:
            log_content = file.read()
        
        # Parse the log content to JSON
        result = parse_log_to_json(log_content)
        
        # Write the result to the output file
        with open(json_output_path, 'w', encoding='utf-8') as file:
            json.dump(result, file, indent=2, ensure_ascii=False)
        
        # Update the timestamp for user feedback
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        print(f"[{timestamp}] JSON updated - {len(result['messages'])} messages processed")
        return True
        
    except UnicodeDecodeError:
        # Try with different encoding if UTF-8 fails
        try:
            with open(log_file_path, 'r', encoding='latin-1') as file:
                log_content = file.read()
            
            # Parse the log content to JSON
            result = parse_log_to_json(log_content)
            
            # Write the result to the output file
            with open(json_output_path, 'w', encoding='utf-8') as file:
                json.dump(result, file, indent=2, ensure_ascii=False)
            
            # Update the timestamp for user feedback
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            print(f"[{timestamp}] JSON updated - {len(result['messages'])} messages processed")
            return True
            
        except Exception as e:
            print(f"Error reading file with alternative encoding: {e}")
            return False
    except Exception as e:
        print(f"Error processing log: {e}")
        return False

def monitor_log_file():
    """Monitor the log file for changes and update the JSON output"""
    # Find the log file
    log_file_path = find_log_file()
    
    if not log_file_path:
        print("No log file found in the current directory.")
        return
    
    # Determine the JSON output path
    json_output_path = get_json_output_path(log_file_path)
    
    print(f"Monitoring log file: {os.path.basename(log_file_path)}")
    print(f"JSON output will be written to: {os.path.basename(json_output_path)}")
    
    # Process the log file initially
    last_modified = os.path.getmtime(log_file_path)
    process_log_file(log_file_path, json_output_path)
    
    # Monitor for changes
    try:
        while True:
            # Check if the file has been modified
            current_modified = os.path.getmtime(log_file_path)
            if current_modified > last_modified:
                process_log_file(log_file_path, json_output_path)
                last_modified = current_modified
            
            # Sleep for a short time to avoid high CPU usage
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nMonitoring stopped.")

def main():
    """Main function to find, process, and monitor the log file."""
    # If a specific log file is provided as an argument, use it
    if len(sys.argv) > 1:
        log_file_path = sys.argv[1]
        if not os.path.exists(log_file_path):
            print(f"Error: File {log_file_path} does not exist.")
            sys.exit(1)
        
        # Determine the JSON output path
        json_output_path = get_json_output_path(log_file_path) if len(sys.argv) <= 2 else sys.argv[2]
        
        # Process and monitor the log file
        print(f"Monitoring log file: {log_file_path}")
        print(f"JSON output will be written to: {json_output_path}")
        
        # Process the log file initially
        last_modified = os.path.getmtime(log_file_path)
        process_log_file(log_file_path, json_output_path)
        
        # Monitor for changes
        try:
            while True:
                # Check if the file has been modified
                current_modified = os.path.getmtime(log_file_path)
                if current_modified > last_modified:
                    process_log_file(log_file_path, json_output_path)
                    last_modified = current_modified
                
                # Sleep for a short time to avoid high CPU usage
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nMonitoring stopped.")
    else:
        # No specific log file provided, find one automatically
        monitor_log_file()

if __name__ == "__main__":
    main()