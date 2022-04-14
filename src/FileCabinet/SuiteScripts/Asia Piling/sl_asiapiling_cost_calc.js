/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */


define(['N/ui/serverWidget', 'N/record', 'N/redirect', 'N/search', 'N/format','N/task'],
    function (nsUi, record, redirect, search, nsFormat, nstask) {

        function onRequest(context) {

            try {
                var request = context.request;
                var response = context.response;
                var params = request.parameters;

                if (request.method === 'GET') {
                    log.debug('GET params', params);
                    getHandler(request, response, params);
                } else {
                    postHandler(request, response, params);
                }
            } catch (e) {
                log.error('Error::onRequest', e);
                response.writeLine({ output: 'Error: ' + e.name + ' , Details: ' + e.message });
            }


        }


        function getHandler(request, response, params) {

            var hasDateParams = (!!params.fromdate && !!params.todate)
            var setDefaultDate = params.setdefaultdate || 'T'



            var form = nsUi.createForm({
                title: 'Sales Orders',
                hideNavBar: false
            })

            form.addSubmitButton({
                label: 'Calculate'
            });

            form.clientScriptModulePath = './cs_asiapiling_cost_calc.js';

            //adding sublist
            var sublist = form.addSublist({
                id: 'custpage_results',
                label: 'Opened Sales Orders',
                type: nsUi.SublistType.LIST,
                tab: 'custpage_tab'
            });

            //adding to-from-date fields
            var fromDateFld = form.addField({
                id: 'custpage_fromdate',
                type: nsUi.FieldType.DATE,
                label: 'From Date',
            });

            var toDateFld = form.addField({
                id: 'custpage_todate',
                type: nsUi.FieldType.DATE, 
                label: 'To Date',
            });

            var asOfPeriodFld = form.addField({
                id: 'custpage_asofdate',
                type: nsUi.FieldType.SELECT,
                source : -105,
                label: 'As of Period',
            });
            
             var asofperiod ='109'

            if (!hasDateParams && setDefaultDate == 'T') {
               
                var fromDate = new Date();
                fromDate.setDate(fromDate.getDate() - 7);
                var toDate = new Date();
                toDate.setDate(toDate.getDate() + 1);

                fromDate = nsFormat.format({
                    value: fromDate,
                    type: nsFormat.Type.DATE
                });
                toDate = nsFormat.format({
                    value: toDate,
                    type: nsFormat.Type.DATE
                });

                fromDateFld.defaultValue = fromDate
                toDateFld.defaultValue = toDate
                params.fromdate = fromDate
                params.todate = toDate


                // var asofperiod ='FY 2016 : Q1 2016 : Jan 2016'
                asOfPeriodFld.defaultValue = asofperiod
                params.asofperiod = asofperiod




            } else {
                fromDateFld.defaultValue = params.fromdate ? nsFormat.format({
                    value: params.fromdate,
                    type: nsFormat.Type.DATE
                }) : '';

                toDateFld.defaultValue = params.todate ? nsFormat.format({
                    value: params.todate,
                    type: nsFormat.Type.DATE
                }) : '';

                asOfPeriodFld.defaultValue = params.asofdate ? nsFormat.format({
                    value: params.asofdate,
                    type: nsFormat.Type.TEXT
                }) : '';

                // asOfPeriodFld.defaultValue = params.asofdate;

            }


            //adding Mark All Buttons

            sublist.addMarkAllButtons();


            if (!!params.fromdate && !!params.todate) {

                var toDate = params.todate;
                var fromDate = params.fromdate;

                if (!!params.asofdate)
                {
                    asofperiod = params.asofdate;
                }
                

                var salesOrderData = getSalesOrderData(toDate, fromDate, asofperiod);
                

                if (!!salesOrderData && salesOrderData.length > 0) {
                   
                    populateSublist(sublist, salesOrderData);
                }
            }

            response.writePage(form);

        }

        function postHandler(request, response, params) {
        


            var selectedLines = getSelectedLines(request);
            log.debug('selectedLines Post', selectedLines);

            if (!!selectedLines) {

               for(var i=0; i<selectedLines.length; i++){
                var queueId = createQueueRecord(selectedLines[i]);
                log.debug("queueId",queueId);
               }
            
                var taskId =  triggerDownload();

                   if (!!queueId) {
                       var form = nsUi.createForm({
                           title: 'COGS Calculation'
                       });
                       showPostForm(form,queueId,taskId,selectedLines.length);
                       form.clientScriptModulePath = './cs_asiapiling_cost_calc.js';
                       response.writePage(form);
                   }
            }

            
        }

        function getSelectedLines(request) {

            var totalLines = request.getLineCount({ group: 'custpage_results' });
            var selectedLines = [];
            for (var i = 0; i < totalLines; i++) {
                var isSelected = request.getSublistValue({
                    group: 'custpage_results',
                    name: 'custpage_select',
                    line: i
                });
                if (isSelected == true || isSelected == 'T') {

                    var sointernalid = request.getSublistValue({
                        group: 'custpage_results',
                        name: 'custpage_internalid',
                        line: i
                    });

                    
                    var soId = request.getSublistValue({
                        group: 'custpage_results',
                        name: 'custpage_invoicenum',
                        line: i
                    });


                    var soDate = request.getSublistValue({
                        group: 'custpage_results',
                        name: 'custpage_trandate',
                        line: i
                    });

                    var postPeriod = request.getSublistValue({
                        group: 'custpage_results',
                        name: 'custpage_postingperiod',
                        line: i
                    });

    
                    var className = request.getSublistValue({
                        group: 'custpage_results',
                        name: 'custpage_class',
                        line: i
                    });

                    selectedLines.push({
                        sointernalid,
                        soId,
                        soDate,
                        postPeriod,
                        className

                    });

                    log.debug("selected lines ",selectedLines);
                }
            }

            return selectedLines;
        }

        function triggerDownload() {
            var task = nstask.create({
                taskType: nstask.TaskType.MAP_REDUCE,
                scriptId: 'customscript_mr_asiapilling_cost_calc'
            });

            return task.submit();
        }



        function createQueueRecord(data) {

            let currentDate = new Date();

            var queueRec = record.create({
                type: 'customrecord_open_so_list'
            });
            
            queueRec.setValue({ fieldId: 'custrecord_queue_status', value: 'pending' });
            queueRec.setValue({ fieldId: 'custrecord_data', value: JSON.stringify(data) });
            queueRec.setValue({ fieldId: 'custrecord207', value: currentDate});

            return queueRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
        }


        function getSalesOrderData(toDate,fromDate,asofperiod) {

            log.audit("toDate ss",toDate);
            log.audit("fromDate ss",fromDate);
            log.audit("asofperiod",asofperiod);

            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                [
                   ["type","anyof","SalesOrd"],
                   "AND", 
                   ["trandate","within",fromDate,toDate],
                   "AND", 
                    ["mainline","is","T"], 
                    "AND", 
                    ["billingstatus","is","T"], 
                    "AND", 
                    ["custbody_class","noneof","@NONE@"]
                ],
                columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "trandate", label: "Date"}),
                    search.createColumn({name: "invoicenum", label: "Sales Order #"}),
                   search.createColumn({name: "postingperiod", label: "Period"}),
                    search.createColumn({name: "class", label: "Class"}),
                   
                ]
             });
            
             var searchResults = salesorderSearchObj.run();
             var salesOrderList = searchResults.getRange({
                start: 0,
                end: 50     
            });

            log.debug("salesOrderList ",salesOrderList);
            //log.debug("salesOrder Id ",salesOrderList[0].id);

            return salesOrderList;


        }

        function populateSublist(sublist, results) {

            log.debug("results[0].id: ", results[0].id);
            log.debug("results[0].columns : ", results[0].columns);


            var columns = results[0].columns;

            log.debug("columns",columns)
            log.debug("columns[0].name",columns[0].name)
            log.debug("columns[0].label",columns[0].label)
            log.debug("columns[0].type",columns[0].type)


            columns = JSON.parse(JSON.stringify(columns));

            sublist.addField({ id: 'custpage_select', label: 'Select', type: nsUi.FieldType.CHECKBOX });

            for (var i = 0; i < columns.length; i++) {
                var subFieldObj = { id: 'custpage_' + columns[i].name, label: columns[i].label, type: columns[i].type };

                log.debug("subFieldObj",subFieldObj);
                if (columns[i].type == 'select' && columns[i].name == 'postingperiod') {
                    subFieldObj['source'] = 'accountingperiod';
                }
               
                if (columns[i].type == 'select' && columns[i].name == 'class') {
                    subFieldObj['source'] = '-101';
                }


                var fld = sublist.addField(subFieldObj);
                if (subFieldObj.type == 'select') {
                    fld.updateDisplayType({ displayType: nsUi.FieldDisplayType.INLINE });
                }
                if (columns[i].type == 'select' && columns[i].name == 'internalid') {
                    fld.updateDisplayType({ displayType: nsUi.FieldDisplayType.HIDDEN});
                }
                if (columns[i].type == 'select' && columns[i].name == 'postingperiod') {
                    fld.updateDisplayType({ displayType: nsUi.FieldDisplayType.HIDDEN});
                }
            }

            for (var i = 0; i < results.length; i++) {
                for (var j = 0; j < columns.length; j++) {
                    var val = results[i].getValue(columns[j]);
                    // log.debug('custpage_' + columns[j].name);
                    // log.debug('value' + val);
                    !!val ? sublist.setSublistValue({ id: 'custpage_' + columns[j].name, value: val, line: i }) : ''
                }
            }

        }



         function showPostForm(form, queueId, taskId, totalLine) {
          
             form.clientScriptModulePath = './cs_asiapiling_cost_calc.js';  
 
             var messageFld = form.addField({
                 id: 'custpage_message',
                 type: nsUi.FieldType.INLINEHTML,
                 label: 'Message'
             });
 
             messageFld.defaultValue = '<span style="font-size:13px">Your records are being processed. Please do not close this window.</span>';
 
             var queueIdFld = form.addField({
                 id: 'custpage_queueid',
                 type: nsUi.FieldType.TEXT,
                 label: 'Queue ID'
             });
             var taskIdFld = form.addField({
                 id: 'custpage_taskid',
                 type: nsUi.FieldType.TEXT, 
                 label: 'Task ID'
             });
             var totalLinesFld = form.addField({
                 id: 'custpage_totalline',
                 type: nsUi.FieldType.TEXT,
                 label: 'Total Records To Process'
             });
 
             queueIdFld.defaultValue = queueId;
             queueIdFld.updateDisplayType({ displayType: nsUi.FieldDisplayType.NODISPLAY });
 
             taskIdFld.defaultValue = taskId;
             taskIdFld.updateDisplayType({ displayType: nsUi.FieldDisplayType.NODISPLAY });
 
             totalLinesFld.defaultValue = totalLine;
             totalLinesFld.updateDisplayType({ displayType: nsUi.FieldDisplayType.INLINE });
             totalLinesFld.updateLayoutType({
                 layoutType: nsUi.FieldLayoutType.OUTSIDEBELOW
             });
             totalLinesFld.updateBreakType({
                 breakType: nsUi.FieldBreakType.STARTROW
             });
 
             return form;
         }

         


        return {
            onRequest: onRequest

        }
    }
);

