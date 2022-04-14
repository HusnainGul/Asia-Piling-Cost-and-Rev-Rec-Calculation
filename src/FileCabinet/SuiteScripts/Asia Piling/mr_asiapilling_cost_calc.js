/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/ui/dialog', 'N/email', 'N/runtime', 'N/search', 'N/record', 'N/format', './ns_constants'],
    function (dialog, email, runtime, search, nsRecord, nsFormat, constant) {


        function updateQueueStatus(cogsResults, queueId) {
            log.audit("cogsResults:",cogsResults);
            log.audit("queueId:",queueId);
            if (cogsResults) {
                var submitFields = {};
               submitFields[constant.PROCESSING_QUEUE.FIELDS.RESULT] = JSON.stringify(cogsResults);
                submitFields[constant.PROCESSING_QUEUE.FIELDS.STATUS] = 'Done';

                nsRecord.submitFields({
                    type: constant.PROCESSING_QUEUE.RECORD_TYPE, 
                    id: queueId,
                    values: submitFields,
                    options: {
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    }
                });
            }

        }


        function getRecordsToProcess() {
            var finalResult = [];
            try {
                var queueSearch = search.create({
                    type: 'customrecord_open_so_list',
                    columns:
                        [
                            search.createColumn({ name: "name", sort: search.Sort.DESC, label: "Name" }),
                            search.createColumn({ name: "custrecord_data", label: "Data" })
                        ],
                    filters: [
                        ["custrecord_data", "isnotempty", ""],
                        "AND",
                        ["custrecord_queue_status", "is", "pending"]

                    ]
                });

                // log.debug("queueSearch : ",queueSearch);

                var results = queueSearch.run().getRange({ start: 0, end: 50 });

                log.debug("Results : ", results);
                log.debug("Results lenght : ", results.length);

                for (var i = 0; i < results.length; i++) {
                    var ids = results[i].getValue({ name: 'custrecord_data' });
                    ids = JSON.parse(ids);

                    // ids.forEach(function (id) {
                    finalResult.push({
                        queueId: results[i].id,
                        soInternalId: ids.sointernalid,
                        soId: ids.soId,
                        soDate: ids.soDate,
                        postPeriod: ids.postPeriod,
                        className: ids.className
                    });
                    // })
                }
            } catch (e) {
                log.error('Error::getRecordsToProcess', e);
            }
            log.debug('finalResult', finalResult);
            return finalResult;
        }


        function getInputData() {

            var invoiceSearchObj = getRecordsToProcess();


            log.debug("getRecordsToProcess", invoiceSearchObj)
            return invoiceSearchObj;
        }

        function map(context) {
            var cogs = true;
      
            var searchResult = JSON.parse(context.value);
       
            // updateQueueStatus(cogs, searchResult.queueId)

            var accountingperiodSearchObj = search.create({
                type: "accountingperiod",
                filters:
                [
                   ["internalid","anyof",searchResult.postPeriod]
                ],
                columns:
                [
                   "enddate"
                ]
             });
             
             var data = accountingperiodSearchObj.run();
             var finalResult = data.getRange(0, 500);
             accountingEndDate = JSON.parse(JSON.stringify(finalResult))
 
             log.debug("accountingEndDate", accountingEndDate[0].values['enddate'])

             var transactionSearchObj = search.create({
                type: "transaction",
            
            
                filters:
                [
                    ["posting","is","T"], 
                    "AND", 
                    ["class","anyof",searchResult.className], 
                    "AND", 
                    ["department","anyof","2","7","8","6","5","1","4","10","3","13","12","11"], 
                    "AND", 
                    ["mainline","is","F"], 
                    "AND", 
                    ["accountingperiod.enddate","within","",accountingEndDate[0].values['enddate']]
                                ],
                columns:
                [
              
                     search.createColumn({
                        name: "class",
                        summary: "GROUP",
                        label: "Class"
                     }),
                     search.createColumn({
                        name: "department",
                        summary: "GROUP",
                        label: "Department"
                     }),
                     search.createColumn({
                        name: "amount",
                        summary: "SUM",
                        label: "Amount"
                     }),
                     search.createColumn({
                        name: "debitamount",
                        summary: "SUM",
                        label: "Amount (Debit)"
                     }),
                     search.createColumn({
                        name: "postingperiod",
                        summary: "GROUP",
                        label: "Period"
                     })
                ]
            });


            var data = transactionSearchObj.run();
            var finalResult = data.getRange(0, 500);
            postingTransactions = JSON.parse(JSON.stringify(finalResult))

            log.debug("postingTransactions", postingTransactions)



            //loading the sales order
            
            var salesOrder = nsRecord.load({
                type: nsRecord.Type.SALES_ORDER,
                id: searchResult.soInternalId,
                isDynamic: true
            });

            log.debug("salesOrder", salesOrder);
            log.debug("searchResult.soInternalId", searchResult.soInternalId);

            var lineCount = salesOrder.getLineCount({
                sublistId: 'item'
            });

            var cogsResults=[];
               
            

            log.debug("postingTransactions.length", postingTransactions.length)
            log.debug("lineCount", lineCount)

            for (var i = 0; i < lineCount; i++) {

                salesOrder.selectLine({ sublistId: 'item', line: i });

               // log.debug("line#", i)
                for (var j = 0; j < postingTransactions.length; j++) {


                    var activityCode = salesOrder.getSublistText({
                        sublistId: 'item',
                        fieldId: 'department_display', //line.cseg_paactivitycode
                        line: i
                    });

                  
                    if (postingTransactions[j].values['GROUP(department)'][0].text == activityCode) {
                      
                       var lineItem = salesOrder.getCurrentSublistText({
                        sublistId: 'item',
                        fieldId: 'item'
                         });


                       cogsResults.push({
                        costCategory : postingTransactions[i].values['GROUP(department)'][0].text,
                        amount : postingTransactions[i].values['SUM(debitamount)'],
                        item : lineItem
                        })

                        salesOrder.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_cumulative_cogs',
                            line: i,
                            value: parseInt(postingTransactions[j].values['SUM(debitamount)'])
                        });
                        


                    }

                }


                salesOrder.commitLine({ sublistId: 'item' })

               
            }

           salesOrder.save();

           log.audit("cogsResults",cogsResults);

           updateQueueStatus(cogsResults, searchResult.queueId)


           //loading Revenue Recognized Field from Sales Order

               var revRecognized = salesOrder.getValue({
                    fieldId: 'custbody54'
                });

                log.audit("revRecognized",revRecognized);

            //creating journal entry
            
            var journal = nsRecord.create({
                type : nsRecord.Type.JOURNAL_ENTRY,
                isDynamic : true
               });
               
               let subsidiary = '3'; //US East               ;
               let date = new Date(2022, 02, 10);
               let memo = 'Creating journal for Asia Pilling';
               let creditAcc = '264'; //Acc.Depr. - Right-Of-Use Asset
               let debitAcc = '177'; //Sales : Revenue - Products

            //set the values in the required fields in JE main section
               journal.setValue('subsidiary',subsidiary);
               journal.setValue('trandate',date);
               journal.setValue('memo',memo)
               
            // Credit line
               journal.selectNewLine('line');
            //Set the value for the field in the currently selected line.
               journal.setCurrentSublistValue('line','account',creditAcc);
               journal.setCurrentSublistValue('line','credit', revRecognized);
               journal.setCurrentSublistValue('line','memo',"Account Balancing");
               //Commits the currently selected line on a sublist.
            journal.commitLine('line');
               
            // Debit Line
               journal.selectNewLine('line');
            //Set the value for the field in the currently selected line.
               journal.setCurrentSublistValue('line','account',debitAcc);
               journal.setCurrentSublistValue('line','debit', revRecognized);
               journal.setCurrentSublistValue('line','memo',"Account Balancing");
            //Commits the currently selected line on a sublist.
               journal.commitLine('line');
               //save the record.
              var jeId= journal.save();
               log.audit("JE ID",jeId)
            
               

             //Updating SalesOrder with Journal Entry Link

             var salesOrderObj = nsRecord.load({
                type: nsRecord.Type.SALES_ORDER,
                id: searchResult.soInternalId,
                isDynamic: true
            });

            log.audit("salesOrderObj",salesOrderObj);

          salesOrderObj.setValue('custbodyjournel_entry_id',jeId)
           // salesOrderObj.setText('custbodyjournel_entry_id',jeId)

            salesOrderObj.save();


        }

        function reduce(context) {

        
        }


        function summary(summary) {

            log.debug("No of Queues", summary.concurrency);

        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summary: summary
        }
    }
);

