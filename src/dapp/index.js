
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;
    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });

        // User-submitted transaction
        DOM.elid('submit-buy-insurance').addEventListener('click', () => {
            let e = DOM.elid("flights");
            let flight = e.options[e.selectedIndex].value;
            let number = flight.split(' |')[0]
            let timestamp = flight.split('| ')[1]
            let value = DOM.elid('insurance-value').value;
            let title = 'Insurance';
            let description = 'Purchase';

            if(value == '') { value = '0' } // obviously the value would usually come via MetaMask anyway but this is to test the prototype so we can try out sending 0 value when purchasing insurance.

            contract.buyInsurance(number, timestamp, value, (error, result) => {
                let errorMsg = 'There was an error';
                if(error) {
                    if(error.toString().includes('revert')) {
                        errorMsg = error.toString().split('revert ')[1]
                    } else {
                        errorMsg = error.toString();
                    }
                    display(title, description, [ { label: 'Failed!', error: errorMsg } ]);
                } else {
                    display(title, description, [ { label: 'Success!', value: `You are now insured on flight: ${result.flight} | ${result.timestamp}` } ]);
                }
            });
        })

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
        })
    });
})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







