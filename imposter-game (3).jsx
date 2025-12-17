import React, { useState, useEffect } from 'react';
import { Users, Brain, Vote, Trophy, Play, ArrowRight } from 'lucide-react';

const ImposterGame = () => {
  // Game states
  const [gamePhase, setGamePhase] = useState('SETUP'); // SETUP, QUESTION, ANSWER, READY, VOTING, RESULTS, HISTORY
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [answers, setAnswers] = useState([]);
  const [votes, setVotes] = useState([]);
  const [imposterIndex, setImposterIndex] = useState(-1);
  const [targetPlayerIndex, setTargetPlayerIndex] = useState(-1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const [timer, setTimer] = useState(0);
  const [difficulty, setDifficulty] = useState('medium'); // easy, medium, hard

  // Setup phase - add players
  const [playerName, setPlayerName] = useState('');

  // Load game history from storage
  useEffect(() => {
    loadGameHistory();
  }, []);

  const loadGameHistory = async () => {
    try {
      const result = await window.storage.get('imposter-game-history');
      if (result?.value) {
        setGameHistory(JSON.parse(result.value));
      }
    } catch (error) {
      console.log('No previous game history');
    }
  };

  const saveGameHistory = async (gameData) => {
    try {
      const history = [...gameHistory, gameData];
      await window.storage.set('imposter-game-history', JSON.stringify(history.slice(-10))); // Keep last 10 games
      setGameHistory(history.slice(-10));
    } catch (error) {
      console.error('Failed to save game history:', error);
    }
  };

  // Add player
  const addPlayer = () => {
    if (playerName.trim() && players.length < 8) {
      setPlayers([...players, {
        id: `player-${Date.now()}`,
        name: playerName.trim(),
        score: 0,
        hasAnswered: false,
        hasVoted: false
      }]);
      setPlayerName('');
    }
  };

  // Remove player
  const removePlayer = (playerId) => {
    setPlayers(players.filter(p => p.id !== playerId));
  };

  // Start game
  const startGame = async () => {
    if (players.length < 3) {
      alert('Need at least 3 players to start!');
      return;
    }

    setLoading(true);
    
    // Pick random imposter
    const imposter = Math.floor(Math.random() * players.length);
    setImposterIndex(imposter);
    
    // Pick random target for imposter to impersonate (not themselves)
    let target = Math.floor(Math.random() * players.length);
    while (target === imposter) {
      target = Math.floor(Math.random() * players.length);
    }
    setTargetPlayerIndex(target);

    // Generate AI question
    await generateQuestion();
    
    setGamePhase('QUESTION');
    setTimer(15);
    setLoading(false);
  };

  // Generate question using AI
  const generateQuestion = async () => {
    try {
      // Difficulty-specific prompts
      const difficultyPrompts = {
        easy: `Generate 1 simple, fun personal question for an imposter game with ${players.length} players. The question should be:
- Very easy to answer (basic preferences, common experiences)
- Not too specific or nuanced
- Something everyone can relate to
- Answers will naturally be similar, making it harder to spot the imposter

Examples: "What's your favorite color?", "Do you prefer coffee or tea?", "What's your favorite season?"

Return ONLY the question, nothing else.`,
        medium: `Generate 1 interesting personal question for an imposter game with ${players.length} players. The question should be:
- Personal enough that answers vary between people
- Not too private or uncomfortable
- Easy to answer in 1-2 sentences
- Something people might know about coworkers or friends

Examples: "What's your favorite way to spend a weekend?", "What's the last thing you learned?", "What's your comfort food?"

Return ONLY the question, nothing else.`,
        hard: `Generate 1 challenging, specific personal question for an imposter game with ${players.length} players. The question should be:
- Very specific and detailed (requiring genuine personal knowledge)
- Create clear differences between people's answers
- Be about unique experiences or specific preferences
- Make it difficult for the imposter to guess correctly

Examples: "What's a specific childhood memory that still makes you smile?", "What's the strangest food combination you genuinely enjoy?", "What's a small daily ritual you can't function without?"

Return ONLY the question, nothing else.`
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: difficultyPrompts[difficulty]
            }
          ],
        })
      });

      const data = await response.json();
      const question = data.content[0].text.trim();
      setCurrentQuestion(question);
    } catch (error) {
      console.error('AI generation failed:', error);
      // Fallback questions based on difficulty
      const fallbackQuestions = {
        easy: [
          "What's your favorite color?",
          "Do you prefer coffee or tea?",
          "What's your favorite season?",
          "Are you a morning person or night owl?",
          "Do you prefer cats or dogs?"
        ],
        medium: [
          "What's your favorite way to spend a weekend?",
          "What's the last thing you learned?",
          "What's your comfort food?",
          "What's your dream vacation destination?",
          "What's a skill you want to learn?"
        ],
        hard: [
          "What's a specific childhood memory that shaped who you are?",
          "What's the most unusual place you've ever fallen asleep?",
          "What's a small daily ritual you can't function without?",
          "What's the strangest food combination you genuinely enjoy?",
          "What's a belief you held strongly but completely changed your mind about?"
        ]
      };
      const questions = fallbackQuestions[difficulty];
      setCurrentQuestion(questions[Math.floor(Math.random() * questions.length)]);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(t => t - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer === 0 && gamePhase === 'QUESTION') {
      setGamePhase('ANSWER');
      setCurrentPlayerIndex(0);
    }
  }, [timer, gamePhase]);

  // Move to next phase after question display
  const proceedToAnswers = () => {
    setGamePhase('READY');
    setCurrentPlayerIndex(0);
  };

  // Submit answer
  const submitAnswer = (answerText) => {
    const newAnswers = [...answers, {
      playerId: players[currentPlayerIndex].id,
      playerName: players[currentPlayerIndex].name,
      text: answerText,
      isImposter: currentPlayerIndex === imposterIndex,
      impersonating: currentPlayerIndex === imposterIndex ? players[targetPlayerIndex].name : null
    }];
    setAnswers(newAnswers);

    // Mark player as answered
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex].hasAnswered = true;
    setPlayers(updatedPlayers);

    // Move to next player or voting phase
    if (currentPlayerIndex < players.length - 1) {
      setCurrentPlayerIndex(currentPlayerIndex + 1);
      setGamePhase('READY'); // Go to ready screen for next player
    } else {
      setGamePhase('VOTING');
      setCurrentPlayerIndex(0);
    }
  };

  // Submit vote
  const submitVote = (suspectId) => {
    const newVotes = [...votes, {
      voterId: players[currentPlayerIndex].id,
      suspectId: suspectId
    }];
    setVotes(newVotes);

    // Mark player as voted
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex].hasVoted = true;
    setPlayers(updatedPlayers);

    // Move to next player or results
    if (currentPlayerIndex < players.length - 1) {
      setCurrentPlayerIndex(currentPlayerIndex + 1);
    } else {
      calculateResults();
    }
  };

  // Calculate results
  const calculateResults = async () => {
    // Count votes
    const voteCounts = {};
    votes.forEach(vote => {
      voteCounts[vote.suspectId] = (voteCounts[vote.suspectId] || 0) + 1;
    });

    // Find player with most votes
    let maxVotes = 0;
    let caughtPlayerId = null;
    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        caughtPlayerId = playerId;
      }
    });

    const imposterPlayer = players[imposterIndex];
    const imposterCaught = caughtPlayerId === imposterPlayer.id;

    // Update scores
    const updatedPlayers = players.map(player => {
      if (imposterCaught) {
        // Imposter caught - voters get points
        const voted = votes.find(v => v.voterId === player.id);
        if (voted && voted.suspectId === imposterPlayer.id) {
          return { ...player, score: player.score + 100 };
        }
      } else {
        // Imposter survived
        if (player.id === imposterPlayer.id) {
          const bonusPoints = maxVotes === 0 ? 50 : 0; // Bonus if no votes
          return { ...player, score: player.score + 200 + bonusPoints };
        }
      }
      return player;
    });

    setPlayers(updatedPlayers);
    setGamePhase('RESULTS');

    // Generate AI analysis
    generateRoundAnalysis(imposterCaught, imposterPlayer);
  };

  // AI Round Analysis
  const [roundAnalysis, setRoundAnalysis] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const generateRoundAnalysis = async (imposterCaught, imposterPlayer) => {
    setLoadingAnalysis(true);
    try {
      const imposterAnswer = answers.find(a => a.isImposter);
      const otherAnswers = answers.filter(a => !a.isImposter).map(a => `${a.playerName}: "${a.text}"`).join('\n');

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `Analyze this imposter game round in 2-3 sentences:

Question: "${currentQuestion}"
Imposter: ${imposterPlayer.name} (trying to impersonate ${players[targetPlayerIndex].name})
Imposter's answer: "${imposterAnswer.text}"

Other players' answers:
${otherAnswers}

Result: ${imposterCaught ? 'Imposter was CAUGHT' : 'Imposter SURVIVED'}

Explain why the imposter was ${imposterCaught ? 'caught' : 'able to blend in'}. Be specific about what gave them away or what helped them succeed.`
            }
          ],
        })
      });

      const data = await response.json();
      setRoundAnalysis(data.content[0].text.trim());
    } catch (error) {
      console.error('Analysis failed:', error);
      setRoundAnalysis(imposterCaught 
        ? "The players successfully identified the imposter through careful observation of the answers!"
        : "The imposter blended in well with the other players' responses!");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Next round
  const nextRound = async () => {
    if (currentRound >= 5) {
      endGame();
      return;
    }

    setLoading(true);
    
    // Reset for next round
    setAnswers([]);
    setVotes([]);
    const updatedPlayers = players.map(p => ({
      ...p,
      hasAnswered: false,
      hasVoted: false
    }));
    setPlayers(updatedPlayers);
    setCurrentRound(currentRound + 1);

    // Pick new imposter (not the same as last round)
    let newImposter = Math.floor(Math.random() * players.length);
    while (newImposter === imposterIndex && players.length > 1) {
      newImposter = Math.floor(Math.random() * players.length);
    }
    setImposterIndex(newImposter);

    // Pick new target
    let newTarget = Math.floor(Math.random() * players.length);
    while (newTarget === newImposter) {
      newTarget = Math.floor(Math.random() * players.length);
    }
    setTargetPlayerIndex(newTarget);

    // Generate new question
    await generateQuestion();
    
    setGamePhase('QUESTION');
    setTimer(15);
    setLoading(false);
  };

  // End game
  const endGame = () => {
    const finalScores = [...players].sort((a, b) => b.score - a.score);
    const gameData = {
      date: new Date().toISOString(),
      rounds: currentRound,
      winner: finalScores[0],
      players: finalScores
    };
    saveGameHistory(gameData);
    setGamePhase('FINAL');
  };

  // Reset game
  const resetGame = () => {
    setGamePhase('SETUP');
    setPlayers([]);
    setCurrentRound(1);
    setCurrentQuestion('');
    setAnswers([]);
    setVotes([]);
    setImposterIndex(-1);
    setTargetPlayerIndex(-1);
    setCurrentPlayerIndex(0);
  };

  // Render different phases
  const renderSetup = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold">AI Imposter Game</h1>
        </div>
        
        <p className="text-gray-600 mb-6">
          Add 3-8 players. One player will be the imposter each round, trying to blend in by impersonating another player!
        </p>

        {/* Difficulty Selector */}
        <div className="mb-6">
          <label className="block font-semibold mb-3">Difficulty Level:</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setDifficulty('easy')}
              className={`p-4 rounded-lg border-2 transition-all ${
                difficulty === 'easy'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-bold text-green-600">😊 Easy</div>
              <div className="text-xs text-gray-600 mt-1">Simple questions, similar answers</div>
            </button>
            <button
              onClick={() => setDifficulty('medium')}
              className={`p-4 rounded-lg border-2 transition-all ${
                difficulty === 'medium'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-bold text-yellow-600">🤔 Medium</div>
              <div className="text-xs text-gray-600 mt-1">Balanced, varied answers</div>
            </button>
            <button
              onClick={() => setDifficulty('hard')}
              className={`p-4 rounded-lg border-2 transition-all ${
                difficulty === 'hard'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-bold text-red-600">🔥 Hard</div>
              <div className="text-xs text-gray-600 mt-1">Specific, unique answers</div>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block font-semibold mb-3">Players:</label>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
              placeholder="Enter player name"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              maxLength={20}
            />
            <button
              onClick={addPlayer}
              disabled={!playerName.trim() || players.length >= 8}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            {players.map(player => (
              <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">{player.name}</span>
                </div>
                <button
                  onClick={() => removePlayer(player.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={startGame}
          disabled={players.length < 3 || loading}
          className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
        >
          {loading ? 'Generating Question...' : (
            <>
              <Play className="w-5 h-5" />
              Start Game ({players.length} players)
            </>
          )}
        </button>

        {gameHistory.length > 0 && (
          <button
            onClick={() => setGamePhase('HISTORY')}
            className="w-full py-3 bg-purple-100 text-purple-700 rounded-lg font-semibold hover:bg-purple-200 flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            View Past Games ({gameHistory.length})
          </button>
        )}
      </div>
    </div>
  );

  const renderQuestion = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-sm text-gray-500 mb-2">Round {currentRound} of 5</div>
          <h2 className="text-2xl font-bold mb-4">Question Time!</h2>
          {timer > 0 && (
            <div className="text-4xl font-bold text-purple-600 mb-4">{timer}s</div>
          )}
        </div>

        <div className="bg-purple-50 rounded-lg p-6 mb-6">
          <p className="text-xl font-semibold text-center">{currentQuestion}</p>
        </div>

        <p className="text-gray-600 text-center mb-6">
          Everyone read this question. One of you is the imposter and will answer as someone else!
        </p>

        <button
          onClick={proceedToAnswers}
          className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center justify-center gap-2"
        >
          Ready to Answer
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderReady = () => {
    const currentPlayer = players[currentPlayerIndex];
    const isImposter = currentPlayerIndex === imposterIndex;

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 mb-2">Round {currentRound} - Player {currentPlayerIndex + 1} of {players.length}</div>
            <h2 className="text-2xl font-bold mb-4">{currentPlayer.name}'s Turn</h2>
          </div>

          {isImposter && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
              <p className="text-red-700 font-semibold text-center">🎭 You are the IMPOSTER!</p>
              <p className="text-red-600 text-sm text-center mt-2">
                Answer as if you were: <strong>{players[targetPlayerIndex].name}</strong>
              </p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold mb-3 text-center">Question:</h3>
            <p className="text-lg font-medium text-center">{currentQuestion}</p>
          </div>

          {answers.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Answers so far:</h3>
              <div className="space-y-2">
                {answers.map((ans, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-500">Player {idx + 1}</div>
                    <div className="text-gray-800">{ans.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setGamePhase('ANSWER')}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            I'm Ready - Start Answering
          </button>
        </div>
      </div>
    );
  };

  // AI Imposter Assistant
  const getImposterSuggestions = async () => {
    try {
      // Get other players' answers submitted so far
      const existingAnswers = answers.map(a => `"${a.text}"`).join(', ');
      const contextInfo = existingAnswers ? `Other answers so far: ${existingAnswers}` : 'You are the first to answer.';

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You're helping someone in an imposter game. They need to answer a question while pretending to be someone else.

Question: "${currentQuestion}"
Target to impersonate: ${players[targetPlayerIndex].name}
${contextInfo}

Generate exactly 3 believable, natural answer suggestions (each 1-2 sentences) that:
1. Sound authentic and conversational (not generic)
2. Match the style of a casual game response
3. Are different from each other
4. Would help them blend in

Return ONLY as a JSON array with no other text: ["answer 1", "answer 2", "answer 3"]`
            }
          ],
        })
      });

      const data = await response.json();
      let suggestionsText = data.content[0].text.trim();
      
      // Clean up any markdown code blocks
      suggestionsText = suggestionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      const suggestions = JSON.parse(suggestionsText);
      return suggestions;
    } catch (error) {
      console.error('AI suggestions failed:', error);
      // Fallback suggestions
      return [
        "I think it depends on the situation really.",
        "Something fun and relaxing, nothing too crazy.",
        "Whatever feels right in the moment, you know?"
      ];
    }
  };

  const renderAnswer = () => {
    const currentPlayer = players[currentPlayerIndex];
    const isImposter = currentPlayerIndex === imposterIndex;
    const [answer, setAnswer] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Load AI suggestions when imposter's turn starts
    useEffect(() => {
      if (isImposter && aiSuggestions.length === 0 && !loadingSuggestions) {
        setLoadingSuggestions(true);
        getImposterSuggestions().then(suggestions => {
          setAiSuggestions(suggestions);
          setLoadingSuggestions(false);
        });
      }
    }, [isImposter]);

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 mb-2">Round {currentRound} - Player {currentPlayerIndex + 1} of {players.length}</div>
            <h2 className="text-2xl font-bold mb-2">{currentPlayer.name}'s Turn</h2>
            {isImposter && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
                <p className="text-red-700 font-semibold">🎭 You are the IMPOSTER!</p>
                <p className="text-red-600 text-sm">Answer as if you were: <strong>{players[targetPlayerIndex].name}</strong></p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-lg font-medium text-center">{currentQuestion}</p>
          </div>

          {isImposter && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">AI Assistant Suggestions</h3>
              </div>
              
              {loadingSuggestions ? (
                <div className="text-center py-4 text-gray-500">
                  <div className="animate-pulse">Generating suggestions...</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {aiSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAnswer(suggestion)}
                      className="w-full p-3 text-left bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 rounded-lg transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-purple-600 font-bold">{idx + 1}.</span>
                        <span className="text-gray-800">{suggestion}</span>
                      </div>
                    </button>
                  ))}
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Click a suggestion to use it, or write your own below
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-24"
              maxLength={200}
            />
            <div className="text-right text-sm text-gray-500 mt-1">
              {answer.length}/200
            </div>
          </div>

          <button
            onClick={() => {
              if (answer.trim()) {
                submitAnswer(answer.trim());
              }
            }}
            disabled={!answer.trim()}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Submit Answer
          </button>
        </div>
      </div>
    );
  };

  const renderVoting = () => {
    const currentPlayer = players[currentPlayerIndex];
    const [selectedSuspect, setSelectedSuspect] = useState('');

    // Shuffle answers for display
    const shuffledAnswers = [...answers].sort(() => Math.random() - 0.5);

    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Voting Time!</h2>
            <p className="text-gray-600">{currentPlayer.name}, who do you think is the imposter?</p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 mb-6">
            <p className="font-medium mb-3">Question: {currentQuestion}</p>
            <div className="space-y-3">
              {shuffledAnswers.map((ans, idx) => (
                <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                  <p className="text-gray-800">{ans.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <p className="font-medium mb-2">Vote for the imposter:</p>
            {players.map(player => {
              if (player.id === currentPlayer.id) return null; // Can't vote for yourself
              return (
                <button
                  key={player.id}
                  onClick={() => setSelectedSuspect(player.id)}
                  className={`w-full p-3 rounded-lg border-2 transition-colors ${
                    selectedSuspect === player.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Vote className="w-5 h-5" />
                    {player.name}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => submitVote(selectedSuspect)}
            disabled={!selectedSuspect}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Cast Vote
          </button>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const imposterPlayer = players[imposterIndex];
    
    // Count votes
    const voteCounts = {};
    votes.forEach(vote => {
      voteCounts[vote.suspectId] = (voteCounts[vote.suspectId] || 0) + 1;
    });

    let maxVotes = 0;
    let caughtPlayerId = null;
    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        caughtPlayerId = playerId;
      }
    });

    const imposterCaught = caughtPlayerId === imposterPlayer.id;

    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-4">
              {imposterCaught ? '🎉 Imposter Caught!' : '😈 Imposter Survived!'}
            </h2>
          </div>

          <div className={`rounded-lg p-6 mb-6 ${imposterCaught ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-lg font-semibold mb-2">
              The imposter was: <span className="text-2xl">{imposterPlayer.name}</span>
            </p>
            <p className="text-gray-700 mb-4">
              Impersonating: {players[targetPlayerIndex].name}
            </p>
            
            <div className="bg-white/50 rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-start gap-2 mb-2">
                <Brain className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                <h4 className="font-semibold text-gray-900">AI Analysis</h4>
              </div>
              {loadingAnalysis ? (
                <p className="text-gray-500 italic animate-pulse">Analyzing the round...</p>
              ) : (
                <p className="text-gray-700">{roundAnalysis}</p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold mb-3">All Answers:</h3>
            <div className="space-y-2">
              {answers.map((ans, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${ans.isImposter ? 'bg-red-50 border-2 border-red-300' : 'bg-gray-50'}`}
                >
                  <div className="font-medium">{ans.playerName} {ans.isImposter && '(IMPOSTER)'}</div>
                  <div className="text-gray-700">{ans.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold mb-3">Vote Results:</h3>
            <div className="space-y-2">
              {players.map(player => (
                <div key={player.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span>{player.name}</span>
                  <span className="font-semibold">{voteCounts[player.id] || 0} votes</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold mb-3">Scoreboard:</h3>
            <div className="space-y-2">
              {[...players].sort((a, b) => b.score - a.score).map((player, idx) => (
                <div key={player.id} className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-white rounded-lg">
                  <div className="flex items-center gap-2">
                    {idx === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <span className="text-xl font-bold text-purple-600">{player.score}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={nextRound}
            disabled={loading}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300"
          >
            {loading ? 'Loading Next Round...' : (currentRound >= 5 ? 'See Final Results' : 'Next Round')}
          </button>
        </div>
      </div>
    );
  };

  const renderFinal = () => {
    const finalScores = [...players].sort((a, b) => b.score - a.score);
    const winner = finalScores[0];

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Game Over!</h2>
            <p className="text-xl text-purple-600">
              Winner: <span className="font-bold">{winner.name}</span> with {winner.score} points!
            </p>
          </div>

          <div className="mb-8">
            <h3 className="font-bold mb-4 text-xl">Final Standings:</h3>
            <div className="space-y-3">
              {finalScores.map((player, idx) => (
                <div key={player.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-white rounded-lg border-2 border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-400">#{idx + 1}</span>
                    {idx === 0 && <Trophy className="w-6 h-6 text-yellow-500" />}
                    <span className="font-semibold text-lg">{player.name}</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">{player.score}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={resetGame}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-purple-600" />
              <h2 className="text-3xl font-bold">Game History</h2>
            </div>
            <button
              onClick={() => setGamePhase('SETUP')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            >
              ← Back
            </button>
          </div>

          {gameHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No games played yet. Start your first game!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {[...gameHistory].reverse().map((game, idx) => {
                const gameDate = new Date(game.date);
                const formattedDate = gameDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={idx} className="border-2 border-gray-200 rounded-lg p-6 hover:border-purple-300 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold">Game #{gameHistory.length - idx}</h3>
                          <span className="text-sm text-gray-500">{formattedDate}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {game.rounds} rounds • {game.players.length} players
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                        <div className="text-right">
                          <div className="font-bold text-lg">{game.winner.name}</div>
                          <div className="text-sm text-gray-600">{game.winner.score} pts</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3 text-sm text-gray-700">Final Standings:</h4>
                      <div className="space-y-2">
                        {game.players.slice(0, 5).map((player, pIdx) => (
                          <div key={pIdx} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-500 w-6">#{pIdx + 1}</span>
                              {pIdx === 0 && <span className="text-lg">👑</span>}
                              <span className="font-medium">{player.name}</span>
                            </div>
                            <span className="font-bold text-purple-600">{player.score}</span>
                          </div>
                        ))}
                        {game.players.length > 5 && (
                          <div className="text-xs text-gray-500 text-center mt-2">
                            +{game.players.length - 5} more players
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="bg-blue-50 rounded p-2 text-center">
                        <div className="text-lg font-bold text-blue-600">{game.winner.score}</div>
                        <div className="text-xs text-gray-600">Top Score</div>
                      </div>
                      <div className="bg-green-50 rounded p-2 text-center">
                        <div className="text-lg font-bold text-green-600">
                          {Math.round(game.players.reduce((sum, p) => sum + p.score, 0) / game.players.length)}
                        </div>
                        <div className="text-xs text-gray-600">Avg Score</div>
                      </div>
                      <div className="bg-purple-50 rounded p-2 text-center">
                        <div className="text-lg font-bold text-purple-600">{game.rounds}</div>
                        <div className="text-xs text-gray-600">Rounds</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {gameHistory.length > 0 && (
            <div className="mt-6 p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold mb-2">Overall Stats:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Total Games:</span>
                  <span className="font-bold ml-2">{gameHistory.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Rounds:</span>
                  <span className="font-bold ml-2">{gameHistory.reduce((sum, g) => sum + g.rounds, 0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    const sortedProfiles = Object.values(playerProfiles).sort((a, b) => b.totalScore - a.totalScore);

    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <h2 className="text-3xl font-bold">Global Leaderboard</h2>
            </div>
            <button
              onClick={() => setGamePhase('SETUP')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            >
              ← Back
            </button>
          </div>

          {sortedProfiles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No player data yet. Play some games!</p>
            </div>
          ) : (
            <>
              {/* Top 3 Podium */}
              {sortedProfiles.length >= 3 && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {/* 2nd Place */}
                  <div className="flex flex-col items-center pt-8">
                    <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center text-2xl font-bold mb-2">
                      2
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg">{sortedProfiles[1].name}</div>
                      <div className="text-sm text-gray-600">{sortedProfiles[1].totalScore} pts</div>
                      <div className="text-xs text-gray-500">{sortedProfiles[1].wins} wins</div>
                    </div>
                  </div>

                  {/* 1st Place */}
                  <div className="flex flex-col items-center">
                    <Trophy className="w-8 h-8 text-yellow-500 mb-2" />
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center text-3xl font-bold mb-2 shadow-lg">
                      1
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-xl">{sortedProfiles[0].name}</div>
                      <div className="text-sm text-gray-600">{sortedProfiles[0].totalScore} pts</div>
                      <div className="text-xs text-gray-500">{sortedProfiles[0].wins} wins</div>
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="flex flex-col items-center pt-12">
                    <div className="w-14 h-14 bg-orange-400 rounded-full flex items-center justify-center text-xl font-bold mb-2">
                      3
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{sortedProfiles[2].name}</div>
                      <div className="text-sm text-gray-600">{sortedProfiles[2].totalScore} pts</div>
                      <div className="text-xs text-gray-500">{sortedProfiles[2].wins} wins</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Rankings */}
              <div className="space-y-3">
                <h3 className="font-bold text-xl mb-4">All Players:</h3>
                {sortedProfiles.map((profile, idx) => {
                  const winRate = profile.gamesPlayed > 0 
                    ? Math.round((profile.wins / profile.gamesPlayed) * 100) 
                    : 0;

                  return (
                    <div
                      key={profile.name}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        idx === 0
                          ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-400'
                          : idx === 1
                          ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300'
                          : idx === 2
                          ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-gray-400">#{idx + 1}</span>
                          {idx === 0 && <Trophy className="w-6 h-6 text-yellow-500" />}
                          <div>
                            <div className="font-bold text-lg">{profile.name}</div>
                            <div className="text-sm text-gray-600">
                              {profile.gamesPlayed} games • {winRate}% win rate
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">
                            {profile.totalScore}
                          </div>
                          <div className="text-xs text-gray-500">total points</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                        <div className="bg-white/50 rounded p-2">
                          <div className="font-bold text-blue-600">{profile.avgScore}</div>
                          <div className="text-xs text-gray-600">Avg/Game</div>
                        </div>
                        <div className="bg-white/50 rounded p-2">
                          <div className="font-bold text-green-600">{profile.highScore}</div>
                          <div className="text-xs text-gray-600">High Score</div>
                        </div>
                        <div className="bg-white/50 rounded p-2">
                          <div className="font-bold text-purple-600">{profile.wins}</div>
                          <div className="text-xs text-gray-600">Wins</div>
                        </div>
                        <div className="bg-white/50 rounded p-2">
                          <div className="font-bold text-orange-600">{profile.totalRounds}</div>
                          <div className="text-xs text-gray-600">Rounds</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 p-4 py-8">
      {gamePhase === 'SETUP' && renderSetup()}
      {gamePhase === 'QUESTION' && renderQuestion()}
      {gamePhase === 'READY' && renderReady()}
      {gamePhase === 'ANSWER' && renderAnswer()}
      {gamePhase === 'VOTING' && renderVoting()}
      {gamePhase === 'RESULTS' && renderResults()}
      {gamePhase === 'FINAL' && renderFinal()}
      {gamePhase === 'HISTORY' && renderHistory()}
    </div>
  );
};

export default ImposterGame;