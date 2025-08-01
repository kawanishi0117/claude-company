-- add_timestamp.lua
-- Add timestamp to log records if missing

function add_timestamp(tag, timestamp, record)
    -- Check if timestamp already exists
    if record["timestamp"] == nil and record["@timestamp"] == nil then
        -- Use current time if no timestamp is provided
        record["@timestamp"] = os.date("!%Y-%m-%dT%H:%M:%S.000Z")
    end
    
    -- Add processing timestamp
    record["processed_at"] = os.date("!%Y-%m-%dT%H:%M:%S.000Z")
    
    -- Add log source information
    if tag:match("^boss%.") then
        record["service"] = "boss-controller"
        record["component_type"] = "boss"
    elseif tag:match("^subordinate%.") then
        record["service"] = "subordinate-controller"
        record["component_type"] = "subordinate"
    elseif tag:match("^dashboard%.") then
        record["service"] = "dashboard"
        record["component_type"] = "ui"
    elseif tag:match("^app%.") then
        record["service"] = "application"
        record["component_type"] = "app"
    else
        record["service"] = "system"
        record["component_type"] = "system"
    end
    
    -- Add log level normalization
    if record["level"] then
        record["log_level"] = string.upper(record["level"])
    end
    
    -- Add severity numeric value for sorting
    if record["log_level"] then
        local severity_map = {
            ["DEBUG"] = 1,
            ["INFO"] = 2,
            ["WARN"] = 3,
            ["WARNING"] = 3,
            ["ERROR"] = 4,
            ["FATAL"] = 5,
            ["CRITICAL"] = 5
        }
        record["severity"] = severity_map[record["log_level"]] or 0
    end
    
    -- Return modified record
    return 1, timestamp, record
end