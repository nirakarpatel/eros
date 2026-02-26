const INDIA_CITIES = [
    { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
    { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
    { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
    { name: 'Pune', lat: 18.5204, lng: 73.8567 },
    { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 }
];

const HOSPITAL_TEMPLATES = [
    { name: 'Apollo Hospital', beds: 50 },
    { name: 'Fortis Healthcare', beds: 40 },
    { name: 'Max Super Speciality', beds: 45 },
    { name: 'Manipal Hospital', beds: 35 },
    { name: 'AIIMS', beds: 100 },
    { name: 'Care Hospitals', beds: 30 },
    { name: 'Medanta The Medicity', beds: 60 },
    { name: 'St. Johns Medical College', beds: 40 }
];

function generateIndiaHospitals() {
    const hospitals = [];
    let idCounter = 1;

    INDIA_CITIES.forEach(city => {
        HOSPITAL_TEMPLATES.forEach((template, index) => {
            // Randomize location around city center (within ~10-15km)
            const lat = city.lat + (Math.random() - 0.5) * 0.15;
            const lng = city.lng + (Math.random() - 0.5) * 0.15;

            hospitals.push({
                id: `HOSP-${idCounter++}`,
                name: `${template.name} - ${city.name}`,
                location: { lat, lng },
                city: city.name,
                beds: Math.floor(Math.random() * template.beds) + 10,
                totalBeds: template.beds + 10
            });
        });
    });

    return hospitals;
}

module.exports = { INDIA_CITIES, generateIndiaHospitals };
