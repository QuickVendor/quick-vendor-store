geolocate_ip() {
    local ip="${1:?Usage: geolocate_ip <ip>}"

    if echo "$ip" | grep -qE "^(0\.0\.0\.0|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|127\.)"; then
        echo "Private/Reserved IP"
        return
    fi

    local result
    result=$(curl -s --max-time 5 "https://ipinfo.io/$ip" 2>/dev/null) || true

    if [ -n "$result" ]; then
        local city country org
        city=$(echo "$result" | grep -o '"city": *"[^"]*"' | cut -d'"' -f4)
        country=$(echo "$result" | grep -o '"country": *"[^"]*"' | cut -d'"' -f4)
        org=$(echo "$result" | grep -o '"org": *"[^"]*"' | cut -d'"' -f4)
        if [ -n "$city" ] || [ -n "$country" ]; then
            echo "${city:-Unknown}, ${country:-Unknown} | ${org:-Unknown}"
            return
        fi
    fi

    echo "Lookup unavailable"
}