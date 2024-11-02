import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Linking, ActivityIndicator, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import axios from 'axios';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import MapView, { Marker } from 'react-native-maps';
import Modal from 'react-native-modal';

const App = () => {
  const [location, setLocation] = useState<Location.LocationData | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<Audio.Recording | null>(null);
  const [buttonText, setButtonText] = useState('SOS');
  const [buttonColor, setButtonColor] = useState('red');
  const [policeStations, setPoliceStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [contacts, setContacts] = useState<string[]>([]);
  const [isAddingContact, setIsAddingContact] = useState(false); // State to manage adding contact
  const [newContact, setNewContact] = useState(''); // State for new contact input

  const storage = getStorage();

  const makeCall = () => {
    if (contacts.length > 0) {
      const callNumber = contacts[0]; // Get the first contact number
      const callURL = `tel:${callNumber}`;
      Linking.openURL(callURL).catch(err => console.error('Error making the call:', err));
    } else {
      Alert.alert('No Contacts', 'No contact numbers saved.', [
        { text: 'Add Contact', onPress: () => setIsAddingContact(true) } // Show option to add contact
      ]);
    }
  };

  const addContact = () => {
    if (newContact) {
      setContacts([...contacts, newContact]);
      setNewContact(''); // Clear input after adding
      setIsAddingContact(false);
      Alert.alert('Success', 'Contact added successfully.');
    } else {
      Alert.alert('Error', 'Please enter a valid contact number.');
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission not granted');
        return;
      }

      const interval = setInterval(async () => {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
        await fetchNearbyPoliceStations(currentLocation.coords.latitude, currentLocation.coords.longitude);
        setLoading(false);
      }, 5000);

      return () => clearInterval(interval);
    })();
  }, []);

  const fetchNearbyPoliceStations = async (latitude: number, longitude: number) => {
    const radius = 5000;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(node["amenity"="police"](around:${radius},${latitude},${longitude}););out;`;

    try {
      const response = await axios.get(overpassUrl);
      if (response.data.elements.length > 0) {
        setPoliceStations(response.data.elements);
      } else {
        Alert.alert('Info', 'No nearby police stations found.');
        setPoliceStations([]);
      }
    } catch (error) {
      console.error('Error fetching police stations:', error);
      Alert.alert('Error', 'Failed to fetch nearby police stations. Please try again later.');
    }
  };

  const showDirections = (station: any) => {
    if (location) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${location.coords.latitude},${location.coords.longitude}&destination=${station.lat},${station.lon}`;
      Linking.openURL(url).catch(err => {
        console.error('Failed to open Google Maps:', err);
      });
    }
  };

  const showDetails = (station: any) => {
    setSelectedStation(station);
  };

  const startRecording = async () => {
    if (isRecording) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Audio permission not granted');
        return;
      }

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      setIsRecording(true);
      setCurrentRecording(newRecording);
      setButtonText('SAFE');
      setButtonColor('green');

      console.log('Recording started'); // Log when recording starts

      setTimeout(async () => {
        await stopAndUploadRecording(newRecording);
      }, 10000);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopAndUploadRecording = async (recording: Audio.Recording) => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stopped'); // Log when recording stops
      if (uri) {
        await uploadRecording(uri);
      }

      setIsRecording(false);
      setCurrentRecording(null);
      setButtonText('SOS');
      setButtonColor('red');
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  const uploadRecording = async (uri: string) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `records/${new Date().toISOString()}.wav`);

      await uploadBytes(storageRef, blob);
      console.log('Recording uploaded'); // Log when recording is uploaded
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const closeModal = () => {
    setSelectedStation(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SafeHer</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Fetching Location...</Text>
        </View>
      ) : (
        <>
          {location && (
            <Text style={styles.location}>
              Latitude: {location.coords.latitude.toFixed(6)}, Longitude: {location.coords.longitude.toFixed(6)}
            </Text>
          )}

          <MapView
            style={styles.map}
            initialRegion={{
              latitude: location?.coords.latitude || 0,
              longitude: location?.coords.longitude || 0,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation={true}
            loadingEnabled={true}
          >
            {location && (
              <Marker coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }} title="Your Location" />
            )}
            {policeStations.map((station) => (
              <Marker
                key={station.id}
                coordinate={{ latitude: station.lat, longitude: station.lon }}
                title={station.tags.name || "Police Station"}
                onPress={() => showDetails(station)}
              />
            ))}
          </MapView>
        </>
      )}

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: buttonColor }]}
          onPress={startRecording}
        >
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Modal for Police Station Details */}
      <Modal isVisible={!!selectedStation} onBackdropPress={closeModal} style={styles.modal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{selectedStation?.tags.name || "Police Station"}</Text>
          <Text style={styles.modalText}>
            Phone: {selectedStation?.tags.phone || "Not available"}
          </Text>
          <TouchableOpacity style={styles.modalButton} onPress={() => showDirections(selectedStation)}>
            <Text style={styles.modalButtonText}>Show Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton} onPress={() => {
            if (selectedStation?.tags.phone) {
              const callURL = `tel:${selectedStation.tags.phone}`;
              Linking.openURL(callURL).catch(err => console.error('Error making the call:', err));
            } else {
              Alert.alert('Error', 'Phone number not available.');
            }
          }}>
            <Text style={styles.modalButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton} onPress={closeModal}>
            <Text style={styles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Call Emergency Contact Button */}
      <TouchableOpacity style={styles.callButton} onPress={makeCall}>
        <Text style={styles.callButtonText}>Call Emergency Contact</Text>
      </TouchableOpacity>

      {/* Modal for Adding Emergency Contact */}
      <Modal isVisible={isAddingContact} onBackdropPress={() => setIsAddingContact(false)} style={styles.modal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Emergency Contact</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter contact number"
            value={newContact}
            onChangeText={setNewContact}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.modalButton} onPress={addContact}>
            <Text style={styles.modalButtonText}>Add Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton} onPress={() => setIsAddingContact(false)}>
            <Text style={styles.modalButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      
    </View>
  );
};
// Styles for the components
const styles = StyleSheet.create({


  callButton: {
    padding: 15,
    backgroundColor: 'blue',
    borderRadius: 5,
    width: '80%',
    alignItems: 'center',
  },
  callButtonText: {
    color: 'white',
    fontSize: 18,
  },
  
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 60,
    color: '#4A90E2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
  },
  location: {
    fontSize: 16,
    marginVertical: 10,
    color: '#333',
  },
  map: {
    width: '100%',
    height: '34%',
  },
  content: {
    padding: 20,
  },
  button: {
    borderRadius: 100,
    paddingVertical: 20,
    paddingHorizontal: 30,
    width: 200,
    height: 200,
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  buttonText: {
    marginTop: 36,
    color: '#ffffff',
    fontSize: 64,
    fontWeight: 'bold',
  },
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10, // Shadow effect
    borderWidth: 1,
    borderColor: '#e2e2e2',
    width: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#4A90E2',
  },
  modalText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: '#555',
  },
  modalButton: {
    padding: 12,
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    marginVertical: 5,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 18,
  },
});

export default App;
