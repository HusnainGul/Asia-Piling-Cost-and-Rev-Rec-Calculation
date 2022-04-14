/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @description This file contains all the constants for the project.
 */

define([], function () {
    return {
        PROCESSING_QUEUE: {   
            RECORD_TYPE: 'customrecord_open_so_list',
            FIELDS: {  
                ACTION: 'custrecord_queue_action',
                RECORD_TYPE: 'custrecord_queue_rec_type',
                RECORD_ID: 'custrecord_queue_rec_id',
                STATUS: 'custrecord_queue_status',
                RESULT: 'custrecord_result' 
                
            }, 
            ACTION: {
                SYNC: 'Sync',
                DOWNLOAD: 'Download'
            },
            STATUS: {
                PENDING: 'Pending',
                PROCESSING: 'Processing',
                ERROR: 'Error',
                DONE: 'Done'
            }
        }
    }
});
