import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export default fp(
  function (fastify: FastifyInstance, _opts: object, done: () => void) {
    const intervalMs = fastify.config.SCAN_INTERVAL * 60 * 1000;
    let isScanning = false;

    const tick = async () => {
      if (isScanning) return;
      isScanning = true;
      try {
        await fastify.scannerService.scan();
      } catch (err) {
        fastify.log.error(err, 'Scanner: fatal error');
      } finally {
        isScanning = false;
      }
    };

    fastify.addHook('onReady', (done) => {
      void tick();
      const timer = setInterval(() => {
        void tick();
      }, intervalMs);

      fastify.addHook('onClose', (_instance, closeDone) => {
        clearInterval(timer);
        closeDone();
      });

      fastify.log.info(
        { intervalMinutes: fastify.config.SCAN_INTERVAL },
        'Scanner: started',
      );
      done();
    });

    done();
  },
  {
    name: 'scannerPlugin',
  },
);
