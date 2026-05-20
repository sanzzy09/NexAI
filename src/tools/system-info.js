import os from 'os';

export const definition = {
  type: "function",
  function: {
    name: "system_info",
    description: "Retrieve comprehensive host resource details, including OS platform, CPU specifications, physical memory state, uptime, and current Node.js process heap allocations.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

export async function execute() {
  console.log(`[SYSTEM_INFO] Collecting system metrics...`);
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);

    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : "Unknown";
    const cpuCores = cpus.length;

    const processMemory = process.memoryUsage();
    
    // Format byte sizes into readable MB/GB
    const formatBytes = (bytes) => {
      const gb = bytes / (1024 * 1024 * 1024);
      if (gb >= 1) return `${gb.toFixed(2)} GB`;
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(2)} MB`;
    };

    const info = {
      os: {
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        arch: os.arch(),
        hostname: os.hostname()
      },
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        speedMhz: cpus.length > 0 ? cpus[0].speed : 0
      },
      memory: {
        total: formatBytes(totalMemory),
        free: formatBytes(freeMemory),
        used: formatBytes(usedMemory),
        usagePercent: `${memoryUsagePercent}%`
      },
      uptime: {
        systemSeconds: os.uptime(),
        processSeconds: process.uptime()
      },
      nodeProcess: {
        pid: process.pid,
        version: process.version,
        heapTotal: formatBytes(processMemory.heapTotal),
        heapUsed: formatBytes(processMemory.heapUsed),
        external: formatBytes(processMemory.external),
        rss: formatBytes(processMemory.rss)
      }
    };

    console.log(`[SYSTEM_INFO] Metrics gathered successfully`);
    return JSON.stringify({
      success: true,
      systemInfo: info
    });
  } catch (error) {
    console.log(`[SYSTEM_INFO] Error gathering metrics: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
}
