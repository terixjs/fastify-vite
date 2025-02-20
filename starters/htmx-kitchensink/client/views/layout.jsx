import './data.client.js'

export const path = '/layout'
export const layout = 'auth'

export const head = <>
  <title>Using Custom Layout</title>
</>

export default function ({ app, req, reply }) {
  return (
    <>
      <h2>Todo List — Using Custom Layout</h2>
      <ul class="list">
        {app.db.todoList.map((item, i) => {
          return <li>{item}</li>
        })}
      </ul>
      <form {...{'hx-on::after-request': 'this.reset()' }}>
        <input name="inputValue" />
        <button
          hx-post="/list/add"
          hx-swap="beforeend"
          hx-target="previous .list">Add</button>
      </form>
      <p>
        <a href="/">Go back to the index</a>
      </p>
      <p>⁂</p>
      <p>This example is exactly the same as <a href="/data">/data</a>,
      except it's wrapped in a custom layout which blocks it until
      <code>req.session.user</code> exists.</p>
    </>
  )
}
