<script>
  import { page } from '$app/stores';
</script>

<div class="error-container">
  <h2>Experience Not Found</h2>
  <p>The experience "{$page.params.catchall}" doesn't exist or is not available.</p>
  <a href="/">Return to Home</a>
</div>

<style>
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    padding: 2rem;
  }
  
  a {
    margin-top: 2rem;
    padding: 0.75rem 1.5rem;
    background-color: #4a5568;
    color: white;
    text-decoration: none;
    border-radius: 0.25rem;
    transition: background-color 0.2s;
  }
  
  a:hover {
    background-color: #2d3748;
  }
</style> 