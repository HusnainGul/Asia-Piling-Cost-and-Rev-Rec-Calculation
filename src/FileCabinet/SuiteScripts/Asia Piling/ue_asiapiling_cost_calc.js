/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 */

 define([ 'N/record','N/search'],
    function(nsRecord,search){
        return {
            afterSubmit : function(context){

                if (context.type === context.UserEventType.EDIT ){

                    log.debug("context",context.newRecord.id);

                //load budget version saved search
                var budgetVersionSearchObj = search.create({
                    type: "customrecord_budget_versions",
                    filters:
                    [
                        ["custrecord206","anyof",context.newRecord.id]
                    ],
                    columns:
                    [
                       search.createColumn({name: "name", label: "Name"}),
                       search.createColumn({name: "custrecord204", label: "Adjusted Budget"}),
                       search.createColumn({name: "custrecord206", label: "sales order #"}),
                       search.createColumn({name: "custrecord203", label: "Version"}),
                       search.createColumn({
                        name: "custrecord205",
                        sort: search.Sort.DESC,
                        label: "Updated on"
                     })
                    ]
                    });
                  


                    
                var data = budgetVersionSearchObj.run();
                var finalResult = data.getRange(0, 1);
                var budgetVersionList = JSON.parse(JSON.stringify(finalResult))

                log.audit("budgetVersionList",budgetVersionList);


                var lastBudgetValue=budgetVersionList[0].values.custrecord204;

    
              
                var salesOrderId = context.newRecord.id;

                var salesOrder = nsRecord.load({
                    type: nsRecord.Type.SALES_ORDER,
                    id: salesOrderId,
                    isDynamic: true,
                });
                

                var adjBudgetAmount = salesOrder.getValue('custbody_adjusted_budget_amount');
                var currentCounter = parseInt(salesOrder.getValue('custbody55')); 
                var tranId = salesOrder.getValue('tranid');

               
                if(!currentCounter){
                    currentCounter=0
                }

                log.audit("currentCounter",currentCounter)

                currentCounter=currentCounter+1;

                var soId = salesOrder.id;  

               var budgetVersionNo='V#'+tranId+'#'+currentCounter;
                var currentDate = new Date();
             

                log.debug('adjBudgetAmount',adjBudgetAmount);
                log.debug('lastBudgetValue',lastBudgetValue);
                log.debug('currentDate',currentDate);
               


                if(lastBudgetValue==adjBudgetAmount){
                    
                    log.audit("Budget not changed!");
               
                }
                else{

                    log.audit("Budget changed!");

                    var salesOrderObj = nsRecord.load({
                        type: nsRecord.Type.SALES_ORDER,
                        id: soId,
                        isDynamic: true
                    });
    
                    salesOrderObj.setValue({ fieldId: 'custbody55', value: parseInt(currentCounter) });
    
                    salesOrderObj.save();

                    log.debug('budgetVersionNo',budgetVersionNo);
                    
                    //creating budget version record
    
                    var budgetVersion = nsRecord.create({
                        type: 'customrecord_budget_versions'
                    });
                    
                    budgetVersion.setValue({ fieldId: 'custrecord203', value: JSON.stringify(budgetVersionNo) });
                    budgetVersion.setValue({ fieldId: 'custrecord204', value:JSON.stringify (adjBudgetAmount)});
                    budgetVersion.setValue({ fieldId: 'custrecord205', value: JSON.stringify(currentDate) });
                    budgetVersion.setValue({ fieldId: 'custrecord206', value: soId });
    
        
    
                    budgetVersion.save({ enableSourcing: true, ignoreMandatoryFields: true });
    
    
                }

        

            }

        
            }

         
            // beforeSubmit : function(context){

            //     if (context.type === context.UserEventType.EDIT ){

                  
            //     var lastSalesOrderSaved = context.oldRecord;
            //     var lastBudgetValue = lastSalesOrderSaved.getValue('custbody_adjusted_budget_amount');

              
            //     var salesOrder = context.newRecord;
            //     var adjBudgetAmount = salesOrder.getValue('custbody_adjusted_budget_amount');
            //     var currentCounter = parseInt(salesOrder.getValue('custbody55')); 
            //     var tranId = salesOrder.getValue('tranid');

               
            //     if(!currentCounter){
            //         currentCounter=0
            //     }

            //     log.audit("currentCounter",currentCounter)

            //     currentCounter=currentCounter+1;

            //     var soId = salesOrder.id;  

            //    var budgetVersionNo='V#'+tranId+'#'+currentCounter;
            //     var currentDate = new Date();
             

            //     log.debug('adjBudgetAmount',adjBudgetAmount);
            //     log.debug('lastBudgetValue',lastBudgetValue);
            //     log.debug('currentDate',currentDate);
               


            //     if(lastBudgetValue==adjBudgetAmount){
                    
            //         log.audit("Budget not changed!");
               
            //     }
            //     else{

            //         log.audit("Budget changed!");

            //         var salesOrderObj = nsRecord.load({
            //             type: nsRecord.Type.SALES_ORDER,
            //             id: soId,
            //             isDynamic: true
            //         });
    
            //         salesOrderObj.setValue({ fieldId: 'custbody55', value: parseInt(currentCounter) });
    
            //         salesOrderObj.save();

            //         log.debug('budgetVersionNo',budgetVersionNo);
                    
            //         //creating budget version record
    
            //         var budgetVersion = nsRecord.create({
            //             type: 'customrecord_budget_versions'
            //         });
                    
            //         budgetVersion.setValue({ fieldId: 'custrecord203', value: JSON.stringify(budgetVersionNo) });
            //         budgetVersion.setValue({ fieldId: 'custrecord204', value:JSON.stringify (adjBudgetAmount)});
            //         budgetVersion.setValue({ fieldId: 'custrecord205', value: JSON.stringify(currentDate) });
            //         budgetVersion.setValue({ fieldId: 'custrecord206', value: soId });
    
        
    
            //         budgetVersion.save({ enableSourcing: true, ignoreMandatoryFields: true });
    
    
            //     }

        

            // }

        
            // }
            


        }
    }
);


