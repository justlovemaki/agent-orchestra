'use strict';

/**
 * Datasource Weather Plugin
 * 
 * 天气数据源插件
 * 展示如何接入外部 API 数据到系统中
 */

const https = require('https');
const http = require('http');

module.exports = async function(plugin, context) {
  async function fetchFromWttr(city) {
    return new Promise((resolve, reject) => {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const current = json.current_condition[0];
            
            resolve({
              city: city,
              temperature: parseInt(current.temp_C),
              condition: current.weatherDesc[0].value,
              humidity: parseInt(current.humidity),
              windSpeed: parseFloat(current.windspeedKmph) / 3.6,
              timestamp: Date.now()
            });
          } catch (error) {
            reject(new Error(`解析天气数据失败: ${error.message}`));
          }
        });
      }).on('error', reject);
    });
  }

  async function fetchFromOpenWeatherMap(city, apiKey, units) {
    return new Promise((resolve, reject) => {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${units}`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            if (json.cod !== 200) {
              reject(new Error(`API 错误: ${json.message}`));
              return;
            }
            
            resolve({
              city: json.name,
              temperature: units === 'fahrenheit' 
                ? Math.round((json.main.temp - 32) * 5 / 9)
                : json.main.temp,
              condition: json.weather[0].description,
              humidity: json.main.humidity,
              windSpeed: json.wind.speed,
              timestamp: Date.now()
            });
          } catch (error) {
            reject(new Error(`解析天气数据失败: ${error.message}`));
          }
        });
      }).on('error', reject);
    });
  }

  plugin.query = async function(queryString, options = {}) {
    const config = { ...plugin.config, ...options };
    const city = options.city || config.defaultCity || 'Beijing';
    const provider = config.provider || 'wttr';
    
    let data;
    
    switch (provider) {
      case 'openweathermap':
        if (!config.apiKey) {
          throw new Error('OpenWeatherMap API 密钥未配置');
        }
        data = await fetchFromOpenWeatherMap(city, config.apiKey, config.units || 'metric');
        break;
        
      case 'wttr':
      default:
        data = await fetchFromWttr(city);
        break;
    }
    
    return {
      provider,
      data,
      schema: plugin.manifest.schema
    };
  };

  plugin.getForecast = async function(city, days = 3) {
    return new Promise((resolve, reject) => {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const weather = json.weather.slice(0, days).map(day => ({
              date: day.date,
              maxTemp: parseInt(day.maxtempC),
              minTemp: parseInt(day.mintempC),
              condition: day.hourly[4].weatherDesc[0].value,
              chanceOfRain: parseInt(day.hourly[4].chanceofrain || 0)
            }));
            
            resolve({
              city,
              forecast: weather,
              timestamp: Date.now()
            });
          } catch (error) {
            reject(new Error(`解析预报数据失败: ${error.message}`));
          }
        });
      }).on('error', reject);
    });
  };

  plugin.test = async function(testConfig) {
    const config = { ...plugin.config, ...testConfig };
    const city = config.defaultCity || 'Beijing';
    
    return await plugin.query(city, {
      city,
      provider: config.provider,
      apiKey: config.apiKey
    });
  };

  plugin.getSchema = function() {
    return plugin.manifest.schema;
  };
};
