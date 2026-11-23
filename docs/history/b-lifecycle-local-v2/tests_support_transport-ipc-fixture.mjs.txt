// OFFLINE process-lifecycle fixture: no worker, database, provider or secrets.
import {disconnectCompletedTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
const emergencyDisconnect = () => process.exit(1);
process.once('disconnect', emergencyDisconnect);
process.send({bodyComplete: true}, () => {
  if (process.argv[2] !== 'legacy') {
    if (process.argv[2] === 'failed') process.exitCode = 7;
    disconnectCompletedTransportChild(process, emergencyDisconnect);
  }
});
