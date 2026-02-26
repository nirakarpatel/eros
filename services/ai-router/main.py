from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import math

app = FastAPI(title="EROS AI Routing Engine")

class Location(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None

class Ambulance(BaseModel):
    id: str
    location: Location
    status: str # 'available', 'busy', 'offline'

class Emergency(BaseModel):
    id: str
    location: Location
    type: str

def calculate_haversine_distance(loc1: Location, loc2: Location) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(math.radians, [loc1.lng, loc1.lat, loc2.lng, loc2.lat])

    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers. Use 3956 for miles.
    return c * r

@app.get("/health")
def health_check():
    return {"status": "online", "engine": "Logic-Router-V1"}

@app.post("/find-nearest")
def find_nearest_ambulance(emergency: Emergency, ambulances: List[Ambulance]):
    if not ambulances:
        raise HTTPException(status_code=400, detail="No ambulances provided")

    available_ambulances = [a for a in ambulances if a.status == "available"]
    
    if not available_ambulances:
        return {"success": False, "message": "No available ambulances within range"}

    # Calculate distances
    scored_ambulances = []
    for amb in available_ambulances:
        dist = calculate_haversine_distance(emergency.location, amb.location)
        scored_ambulances.append({
            "ambulance_id": amb.id,
            "distance_km": round(dist, 2),
            "estimated_time_min": round(dist * 2, 1) # Simple mock: 2 min per km
        })

    # Sort by distance
    sorted_ambulances = sorted(scored_ambulances, key=lambda x: x["distance_km"])

    return {
        "success": True,
        "emergency_id": emergency.id,
        "recommendations": sorted_ambulances[:3] # Return top 3
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
