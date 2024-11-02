import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Text } from 'react-native';
import Groq from 'groq-sdk';
import Markdown from 'react-native-markdown-display';
import { ThemedView } from '@/components/ThemedView'; // Assuming ThemedView is properly defined
import * as Location from 'expo-location';

const GROQ_API_KEY = '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'; // Replace with your actual API key

const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

export default function TabTwoScreen() {
  const [userMessage, setUserMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState(null); // State to store the location

  // Function to get the user's location
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return;
    }

    // Get the user's current location
    const userLocation = await Location.getCurrentPositionAsync({});
    setLocation(userLocation.coords); // Store latitude and longitude
  };

  // Call getLocation on component mount
  useEffect(() => {
    getLocation();
  }, []);

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;

    // Prepare user input with the location
    const userInput = `User Input: "[${userMessage}, Latitude: ${location?.latitude}, Longitude: ${location?.longitude}]"`;

    const newUserMessage = { role: 'user', content: userInput };

    // Add the user's message to the current messages state
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setUserMessage(''); // Clear the input

    // Template for the response
    const responseTemplate = `


i am in Mysore, i am in danger, please help me
`;
    try {
      setIsLoading(true);

      const chatCompletion = await groq.chat.completions.create({
        messages: updatedMessages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant', // Ensure correct role
          content: msg.content,
        })),
        model: 'llama3-8b-8192',
        temperature: 1,
        max_tokens: 1024,
        top_p: 1,
        stream: false,
        stop: null,
      });

      const responseContent = `$\nAssistant Response: ${chatCompletion.choices[0]?.message.content || 'No response'}`;
      const botMessage = { role: 'assistant', content: responseContent };

      // Append the bot's message to the messages array
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error fetching chat response:', error);
      const errorMessage = { role: 'assistant', content: 'Error: Unable to get response.' };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.messagesContainer} contentContainerStyle={{ paddingBottom: 20 }}>
        {messages.map((message, index) => (
          <View key={index} style={message.role === 'user' ? styles.userBubble : styles.botBubble}>
            {message.role === 'assistant' ? (
              <Markdown style={styles.markdown}>
                {message.content}
              </Markdown>
            ) : (
              <Text style={styles.messageText}>{message.content}</Text>
            )}
          </View>
        ))}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
          </View>
        )}
      </ScrollView>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          value={userMessage}
          onChangeText={setUserMessage}
        />
        <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#f0f4f8',
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 10,
  },
  userBubble: {
    marginVertical: 5,
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#d1e7dd',
    alignSelf: 'flex-end',
    maxWidth: '80%',
    borderBottomRightRadius: 0,
  },
  botBubble: {
    marginVertical: 5,
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f8d7da',
    alignSelf: 'flex-start',
    maxWidth: '80%',
    borderBottomLeftRadius: 0,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  markdown: {
    body: {
      fontSize: 16,
      color: '#333',
    },
    link: {
      color: '#007bff',
      textDecorationLine: 'underline',
    },
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    padding: 10,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    flex: 1,
    backgroundColor: '#fff',
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#007bff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
