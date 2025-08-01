#!/bin/bash
# Claude Company System - Kibana Setup Script
# Automatically configure Kibana with dashboards and index patterns

set -e

KIBANA_HOST=${KIBANA_HOST:-"localhost:5601"}
ELASTICSEARCH_HOST=${ELASTICSEARCH_HOST:-"localhost:9200"}
DASHBOARD_FILE="/usr/share/kibana/config/kibana-dashboard.json"

echo "🔧 Setting up Kibana for Claude Company System..."

# Wait for Kibana to be ready
echo "⏳ Waiting for Kibana to be ready..."
for i in {1..30}; do
    if curl -f -s "http://${KIBANA_HOST}/api/status" > /dev/null 2>&1; then
        echo "✅ Kibana is ready!"
        break
    fi
    echo "   Attempt $i/30: Kibana not ready yet, waiting 10 seconds..."
    sleep 10
done

# Wait for Elasticsearch to be ready
echo "⏳ Waiting for Elasticsearch to be ready..."
for i in {1..30}; do
    if curl -f -s "http://${ELASTICSEARCH_HOST}/_cluster/health" > /dev/null 2>&1; then
        echo "✅ Elasticsearch is ready!"
        break
    fi
    echo "   Attempt $i/30: Elasticsearch not ready yet, waiting 10 seconds..."
    sleep 10
done

# Create index template for Claude logs
echo "📝 Creating index template for Claude logs..."
curl -X PUT "http://${ELASTICSEARCH_HOST}/_index_template/claude-logs-template" \
  -H 'Content-Type: application/json' \
  -d '{
    "index_patterns": ["claude-logs-*"],
    "template": {
      "settings": {
        "index": {
          "number_of_shards": 1,
          "number_of_replicas": 0,
          "refresh_interval": "5s"
        }
      },
      "mappings": {
        "properties": {
          "@timestamp": {
            "type": "date",
            "format": "strict_date_optional_time||epoch_millis"
          },
          "@tag": {
            "type": "keyword"
          },
          "level": {
            "type": "keyword"
          },
          "log_level": {
            "type": "keyword"
          },
          "severity": {
            "type": "integer"
          },
          "message": {
            "type": "text",
            "analyzer": "standard"
          },
          "service": {
            "type": "keyword"
          },
          "component_type": {
            "type": "keyword"
          },
          "agentId": {
            "type": "keyword"
          },
          "taskId": {
            "type": "keyword"
          },
          "duration": {
            "type": "long"
          },
          "cpu_usage": {
            "type": "float"
          },
          "memory_usage": {
            "type": "float"
          },
          "hostname": {
            "type": "keyword"
          },
          "processed_at": {
            "type": "date"
          }
        }
      }
    },
    "priority": 200,
    "version": 1,
    "_meta": {
      "description": "Index template for Claude Company System logs"
    }
  }'

echo "✅ Index template created successfully!"

# Check if index pattern already exists
echo "🔍 Checking for existing index patterns..."
INDEX_PATTERN_EXISTS=$(curl -s "http://${KIBANA_HOST}/api/saved_objects/index-pattern/claude-logs-*" | grep -o '"found":true' || echo "")

if [ -z "$INDEX_PATTERN_EXISTS" ]; then
    echo "📋 Creating index pattern..."
    curl -X POST "http://${KIBANA_HOST}/api/saved_objects/index-pattern/claude-logs-*" \
      -H 'Content-Type: application/json' \
      -H 'kbn-xsrf: true' \
      -d '{
        "attributes": {
          "title": "claude-logs-*",
          "timeFieldName": "@timestamp",
          "fields": "[{\"name\":\"@timestamp\",\"type\":\"date\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"@tag\",\"type\":\"string\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"level\",\"type\":\"string\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"log_level\",\"type\":\"string\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"severity\",\"type\":\"number\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"message\",\"type\":\"string\",\"searchable\":true,\"aggregatable\":false},{\"name\":\"service\",\"type\":\"string\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"component_type\",\"type\":\"string\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"agentId\",\"type\":\"string\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"taskId\",\"type\":\"string\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"duration\",\"type\":\"number\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"cpu_usage\",\"type\":\"number\",\"searchable\":true,\"aggregatable\":true},{\"name\":\"memory_usage\",\"type\":\"number\",\"searchable\":true,\"aggregatable\":true}]"
        }
      }'
    echo "✅ Index pattern created!"
else
    echo "ℹ️  Index pattern already exists, skipping creation."
fi

# Set the default index pattern
echo "🎯 Setting default index pattern..."
curl -X POST "http://${KIBANA_HOST}/api/kibana/settings/defaultIndex" \
  -H 'Content-Type: application/json' \
  -H 'kbn-xsrf: true' \
  -d '{
    "value": "claude-logs-*"
  }'

# Import dashboards if file exists
if [ -f "$DASHBOARD_FILE" ]; then
    echo "📊 Importing dashboards..."
    curl -X POST "http://${KIBANA_HOST}/api/saved_objects/_import" \
      -H 'kbn-xsrf: true' \
      -F file=@"$DASHBOARD_FILE"
    echo "✅ Dashboards imported successfully!"
else
    echo "⚠️  Dashboard file not found, skipping dashboard import."
fi

# Create some sample searches
echo "🔍 Creating sample searches..."

# Error logs search
curl -X POST "http://${KIBANA_HOST}/api/saved_objects/search" \
  -H 'Content-Type: application/json' \
  -H 'kbn-xsrf: true' \
  -d '{
    "attributes": {
      "title": "Error Logs - Last 24h",
      "description": "All error level logs from the last 24 hours",
      "hits": 0,
      "columns": ["@timestamp", "service", "level", "message"],
      "sort": [["@timestamp", "desc"]],
      "version": 1,
      "kibanaSavedObjectMeta": {
        "searchSourceJSON": "{\"index\":\"claude-logs-*\",\"query\":{\"bool\":{\"must\":[{\"match\":{\"level\":\"ERROR\"}}]}},\"filter\":[{\"range\":{\"@timestamp\":{\"gte\":\"now-24h\",\"lte\":\"now\"}}}]}"
      }
    }
  }'

# Agent activity search
curl -X POST "http://${KIBANA_HOST}/api/saved_objects/search" \
  -H 'Content-Type: application/json' \
  -H 'kbn-xsrf: true' \
  -d '{
    "attributes": {
      "title": "Agent Activity - Last 4h",
      "description": "All agent activity from the last 4 hours",
      "hits": 0,
      "columns": ["@timestamp", "agentId", "service", "message"],
      "sort": [["@timestamp", "desc"]],
      "version": 1,
      "kibanaSavedObjectMeta": {
        "searchSourceJSON": "{\"index\":\"claude-logs-*\",\"query\":{\"bool\":{\"must\":[{\"exists\":{\"field\":\"agentId\"}}]}},\"filter\":[{\"range\":{\"@timestamp\":{\"gte\":\"now-4h\",\"lte\":\"now\"}}}]}"
      }
    }
  }'

# Performance monitoring search
curl -X POST "http://${KIBANA_HOST}/api/saved_objects/search" \
  -H 'Content-Type: application/json' \
  -H 'kbn-xsrf: true' \
  -d '{
    "attributes": {
      "title": "Performance Metrics",
      "description": "Performance metrics and resource usage",
      "hits": 0,
      "columns": ["@timestamp", "service", "cpu_usage", "memory_usage", "duration"],
      "sort": [["@timestamp", "desc"]],
      "version": 1,
      "kibanaSavedObjectMeta": {
        "searchSourceJSON": "{\"index\":\"claude-logs-*\",\"query\":{\"bool\":{\"should\":[{\"exists\":{\"field\":\"cpu_usage\"}},{\"exists\":{\"field\":\"memory_usage\"}},{\"exists\":{\"field\":\"duration\"}}]}},\"filter\":[]}"
      }
    }
  }'

echo "✅ Sample searches created!"

# Create alerting rules
echo "🚨 Setting up alerting rules..."

# High error rate alert
curl -X POST "http://${KIBANA_HOST}/api/alerting/rule" \
  -H 'Content-Type: application/json' \
  -H 'kbn-xsrf: true' \
  -d '{
    "name": "High Error Rate Alert",
    "consumer": "alerts",
    "enabled": true,
    "rule_type_id": ".index-threshold",
    "schedule": {
      "interval": "1m"
    },
    "params": {
      "index": ["claude-logs-*"],
      "timeField": "@timestamp",
      "aggType": "count",
      "termSize": 5,
      "termField": "service.keyword",
      "thresholdComparator": ">",
      "threshold": [10],
      "timeWindowSize": 5,
      "timeWindowUnit": "m",
      "filterQuery": {
        "bool": {
          "must": [
            {
              "match": {
                "level": "ERROR"
              }
            }
          ]
        }
      }
    },
    "actions": []
  }' || echo "⚠️  Alert creation failed (this is normal if alerting is not fully configured)"

echo "🎉 Kibana setup completed successfully!"
echo ""
echo "📋 Access Points:"
echo "   • Kibana UI: http://${KIBANA_HOST}"
echo "   • Elasticsearch: http://${ELASTICSEARCH_HOST}"
echo ""
echo "🎯 Available Dashboards:"
echo "   • Claude Company System - Overview"
echo "   • Agent Performance Dashboard"
echo ""
echo "🔍 Available Searches:"
echo "   • Error Logs - Last 24h"
echo "   • Agent Activity - Last 4h"  
echo "   • Performance Metrics"
echo ""
echo "🚨 Alerts configured for:"
echo "   • High error rate detection"
echo ""