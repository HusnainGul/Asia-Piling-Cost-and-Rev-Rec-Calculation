/** 
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope public 
 */


 define(['N/currentRecord', 'N/record', 'N/url', 'N/format', 'N/ui/message', 'N/ui/dialog', 'N/search', './ns_constants.js'],
 function (nsCurrentRec, nsRecord, nsUrl, nsFormat, nsMessage, nsDialog, nsSearch,constant) {

	 var Processing_Text = 'Processing';
	 var suiteletName = '';
	
	 function pageInit(context) {
		 try {
			 window.onbeforeunload = null;

			 var currentRec = context.currentRecord;
			 var queueId = currentRec.getValue({fieldId: 'custpage_queueid'});
			 var taskIdFld = currentRec.getField({fieldId: 'custpage_taskid'});
			 var taskId = currentRec.getValue({fieldId: 'custpage_taskid'});
			 var totalLine = currentRec.getValue({fieldId: 'custpage_totalline'});

			 if (!!queueId && !!taskId) {
				 var message = showMessage()
				 checkStatus(message);
			 }
			 else if (!!taskIdFld && !taskId) {
				 var message = showErrorMessage();
				 nsRecord.delete({type: 'customrecord_open_so_list', id: queueId})
			 }
		 }
		 catch (e) {
			 console.log('Error::pageInit', e);
			 log.error('Error::pageInit', e);
		 }
	 }


	 function saveRecord(context) {
		 try {
			 var currentRec = context.currentRecord;
			 var selectedLines = hasSelectedLines(currentRec);

			 if (selectedLines.length == 0) {
				 alert('Please select at least one record to process');
				 //set custpage_delete to false whenever returning false.
				 setFieldValue(currentRec, 'custpage_delete', false);
				 return false;
			 }
		 }
		 catch (e) {
			 console.error('Error::saveRecord', e);
			 log.error('Error::saveRecord', e);
		 }

		 return true;
	 }

	 function fieldChanged(context) {
		 var currentRec = context.currentRecord;
		 var sublistId = context.sublistId;
		 var fieldId = context.fieldId;

		 try {
			
			 if (!sublistId) {
				 var url = getSuiteletURL();
				 var urlArray = [url];

				 if (fieldId == 'custpage_asofdate') {
					var asofdate = currentRec.getValue({fieldId: fieldId});
					var fromDate = currentRec.getValue({fieldId: 'custpage_fromdate'});
					var toDate = currentRec.getValue({fieldId: 'custpage_todate'});

					var hasDates = !!fromDate && !!toDate
					var hasToRedirect = true

					if (!!asofdate) {
						urlArray.push('asofdate=' + asofdate)
						urlArray.push('setdefaultdate=' + 'F')
					}
					passDateFilters(currentRec, urlArray);
					if (!!urlArray && hasToRedirect) {
						redirect(urlArray);
					}
				}

				 else if (fieldId == 'custpage_fromdate' || fieldId == 'custpage_todate') {
					 var asofdate = currentRec.getValue({fieldId: 'custpage_asofdate'});
					 var fromDate = currentRec.getValue({fieldId: 'custpage_fromdate'});
					 var toDate = currentRec.getValue({fieldId: 'custpage_todate'});
					
					 var shouldRedirect = false;
					 if (!!asofdate) {
						 urlArray.push('asofdate=' + asofdate)
						 urlArray.push('setdefaultdate=' + 'F')
						 hasToRedirect = true
					 }

					 if (!!fromDate && !!toDate) {
						 passDateFilters(currentRec, urlArray);
						 redirect(urlArray);
					 }

					 if (!fromDate && !toDate && hasToRedirect) {
						 redirect(urlArray)
					 }

				 }
				 
			 }

		 }
		 catch (e) {
			 console.error('Error::fieldChanged::' + fieldId, e);
			 log.error('Error::fieldChanged::' + fieldId, e);
		 }
	 }

	 function passDateFilters(currentRec, urlArray) {
		 var fromDate = currentRec.getValue({fieldId: 'custpage_fromdate'});
		 var toDate = currentRec.getValue({fieldId: 'custpage_todate'});
		 if (!!toDate && !!fromDate) {
			 toDate = nsFormat.format({value: toDate, type: nsFormat.Type.DATE});
			 fromDate = nsFormat.format({value: fromDate, type: nsFormat.Type.DATE})
			 !!fromDate ? urlArray.push('fromdate=' + fromDate) : ''
			 !!toDate ? urlArray.push('todate=' + toDate) : ''
		 }

		 return urlArray;
	 }

	 function redirect(urlArray) {
		 console.log('url', urlArray.join('&'));
		 window.location = window.location.origin + urlArray.join('&');
	 }

	 function resetFilters() {
		 window.location = window.location.origin + getSuiteletURL();
	 }

	 function showMessage() {
		 var message = nsMessage.create({
			 type: nsMessage.Type.INFORMATION,
			 title: 'Processing',
			 message: 'The records are being processed. Please do not close or navigate away from the screen until process is complete and confirmation window appears.'
		 });

		 message.show();

		 return message;
	 }

	 function showErrorMessage() {
		 var message = nsMessage.create({
			 type: nsMessage.Type.ERROR,
			 title: 'Error',
			 message: 'Script processing queues are not available. Please try again later.'
		 });

		 message.show();

		 return message;
	 }

	 function isValidDateRange(fromDate, toDate) {
		 return fromDate <= toDate
	 }


	 function setFieldValue(currRec, fieldId, value) {
		 currRec.setValue({
			 fieldId: fieldId,
			 value: value,
			 ignoreFieldChange: true
		 });
	 }

	    
	 function checkStatus(msg) {
	
		 var currentRec = nsCurrentRec.get();

		 var totalLine = currentRec.getValue({fieldId: 'custpage_totalline'});
		 var taskId = currentRec.getValue({fieldId: 'custpage_taskid'});
		 var queueId = currentRec.getValue({fieldId: 'custpage_queueid'});

		 var a = setInterval(function () {
			 Processing_Text = Processing_Text.lastIndexOf('.') > 15 ? 'Processing' : Processing_Text + '.';
			 //1.0 is used because 2.0 is not able to update this field value
			 nlapiSetFieldValue('custpage_message', '<span style="font-size:13px">' + Processing_Text + '</span>');
		 }, 1000)


		 var b = setInterval(function (msg, queueId, currentRec) {
			 var processingStatus = constant.PROCESSING_QUEUE.STATUS
			 var processingFields = constant.PROCESSING_QUEUE.FIELDS

			 nsSearch.lookupFields.promise({
				 type: 'customrecord_open_so_list',
				 id: queueId, 
				 columns: ['custrecord_queue_status', 'custrecord_result']
			 }).then(function (result) {
				 console.log('result', result);
				 var queueStatus = result['custrecord_queue_status']
				 if (queueStatus == 'Done') {
					 clearInterval(a);
					 clearInterval(b);
					 msg.hide();
					 updateMessage(result);
				 }
			 }).catch(function onRejected(reason) {
				 console.log('Error', reason)
			 });

		 }, 5000 * totalLine, msg, queueId, currentRec);
	 }
	 
	 
	 function updateMessage(result) {
		var processingFields = constant.PROCESSING_QUEUE.FIELDS
		var currentRec = nsCurrentRec.get();

		//1.0 is used because due to unknown reasons 2.0 is not able to update this field value
		nlapiSetFieldValue('custpage_message', '<span style="font-size:13px">You can now close this window.</span>');

		var msg = result[processingFields.STATUS];

		var newMessage = nsMessage.create({
			type: nsMessage.Type.CONFIRMATION,
			title: 'Processing Completed',
			message: msg
		});

		newMessage.show();
		// showPopup(result);
	}



	 function getSuiteletURL() {
	
		 return nsUrl.resolveScript({
			 scriptId: 'customscript_sl_asiapiling_cost_calc',
			 deploymentId: 'customdeploy_sl_asiapiling_cost_calc'
		 });

	 }


	 function hasSelectedLines(currentRec) {
		 var totalLines = currentRec.getLineCount({sublistId: 'custpage_results'});
		 var selectedLines = 0;
		 var selectedLinesIndex = [];
		 for (var i = 0; i < totalLines; i++) {
			 var isSelected = currentRec.getSublistValue({
				 sublistId: 'custpage_results',
				 fieldId: 'custpage_select',
				 line: i
			 });
			 if (isSelected == true || isSelected == 'T') {
				 selectedLines++;
				 selectedLinesIndex.push(currentRec.getSublistValue({
					sublistId: 'custpage_results',
					fieldId: 'fieldid',
					line: i
				}));
			 }
		 }

		 return selectedLinesIndex;
	 }

	 function validateField(context) {
		 try {
			 var currentRec = context.currentRecord;
			 var fromDate = currentRec.getValue({fieldId: 'custpage_fromdate'});
			 var toDate = currentRec.getValue({fieldId: 'custpage_todate'});
			 switch (context.fieldId) {
				 case 'custpage_fromdate':
				 case 'custpage_todate':
					 if (!!toDate && !!fromDate && !isValidDateRange(new Date(fromDate), new Date(toDate))) {
						 alert('Date Range Is Not Valid')
						 currentRec.setValue({
							 fieldId: context.fieldId,
							 value: '',
							 ignoreFieldChange: true
						 });
						 return false;
					 }
					 return true

			 }
		 }
		 catch (e) {
			 console.error('validateField', e);
		 }

		 return true;
	 }

	 return {
		 pageInit: pageInit,
		 fieldChanged: fieldChanged,
		 saveRecord: saveRecord,
		 resetFilters: resetFilters,
		 validateField: validateField

	 };
 }
);


