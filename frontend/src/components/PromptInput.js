import React, { useState } from 'react';

const PromptInput = ({ onSubmit, placeholder = "Enter your prompt here..." }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(prompt);
    setPrompt(''); // Clear after submit
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholder}
        rows="4"
        cols="50"
      />
      <br />
      <button type="submit">Submit</button>
    </form>
  );
};

export default PromptInput;