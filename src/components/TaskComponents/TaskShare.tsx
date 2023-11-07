/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */
import React from 'react';
import { useState, useEffect } from 'react'
import { API, graphqlOperation } from 'aws-amplify'
import { Link } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { listTodos, createTodo, deleteTodo, updateTodo , onCreateTodo, onUpdateTodo, onDeleteTodo} from '../../types'
import { GraphQLQuery, GraphQLSubscription } from '@aws-amplify/api';
import { CreateTodoMutation, UpdateTodoMutation,DeleteTodoMutation, ListTodosQuery, OnCreateTodoSubscription, OnUpdateTodoSubscription, OnDeleteTodoSubscription, Todo } from '../../types/API';
import { Button, Text, Badge, View,Flex } from '@aws-amplify/ui-react';

interface IClassProps {
  tenantId: string;
  user: any;
}

const TaskShare: React.FC<IClassProps> = ({ tenantId, user }) => {
    const [todos, setTodos] = useState<Todo[]>()
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const userId = user.attributes!['sub']
    let uniqueId: string  

    useEffect(() => {

      uniqueId = uuid();

      const fetchTodos = async () => {
      
        let {data,  errors} = await API.graphql<GraphQLQuery<ListTodosQuery>>(graphqlOperation(listTodos))
        if (data) { setTodos(data?.listTodos as Todo[]); 
          //console.log("data fetched: ", data) 
        } else { 
          console.log(errors) 
        }
      }

      fetchTodos()

      const createSub = API.graphql<GraphQLSubscription<OnCreateTodoSubscription>>(graphqlOperation(onCreateTodo))
      .subscribe({next: ({provider, value: { data } }) => {const todo = data?.onCreateTodo; 
        setTodos(prevTodos => [...prevTodos as Todo[], todo as Todo]); 
        //console.log({ provider, value: { data } }) 
      },
        error: error => console.warn('onCreateTodo subscription error', error)
      });



      const updateSub = API.graphql<GraphQLSubscription<OnUpdateTodoSubscription>>(
        graphqlOperation(onUpdateTodo)
      ).subscribe({
        next: ({ value }) => {
          setTodos((todos: any) => {
            const toUpdateIndex = todos?.findIndex((item: any) => item.id === value?.data?.onUpdateTodo?.id);
            if (toUpdateIndex === -1) {
              return [...todos, value?.data?.onUpdateTodo].filter(Boolean);
            }
            return [
              ...todos.slice(0, toUpdateIndex),  value?.data?.onUpdateTodo,   ...todos.slice(toUpdateIndex + 1),
            ].filter(Boolean);
          });
        },
      });
    


      const deleteSub = API.graphql<GraphQLSubscription<OnDeleteTodoSubscription>>(graphqlOperation(onDeleteTodo))
      .subscribe({ next: ({ value: { data } }) => { const deletedTodo = data?.onDeleteTodo;
          setTodos(prevTodos =>  prevTodos?.filter(todo => todo.id !== deletedTodo?.id ));
        },
        error: error => console.log('onDeleteTodo subscription error', error)
      });
  
      return () => {
        createSub.unsubscribe();
        updateSub.unsubscribe()
        deleteSub.unsubscribe()
      }
      

    }, [])


  return (
    <Flex direction={"column"} padding={8}>

      <div style={{ textAlign: 'center' }}>
        <h2>{user.attributes['preferred_username']} Todo List</h2>
        <Link to="/home">Return Home</Link>
      </div>


    
       
    <Button onClick={async () => {
        const todoContent = window.prompt('Enter Todo Text');
        if(todoContent){
          const newTodo = await API.graphql<GraphQLQuery<CreateTodoMutation>>({ 
            query: createTodo, 
            variables: {
              input: {
                createdAt: (new Date()).toISOString().split('T')[0], 
                updatedAt: (new Date()).toISOString().split('T')[0], 
                tenantId: tenantId,
                sub: userId,
              content: todoContent, 
                owners: [user.attributes!['preferred_username']]
                }
            },
          }) 
        }
      }}

      className="bold-green-button" 
      style={{ fontWeight: 'bold', fontSize: '20px', color: 'green', marginRight: 'auto' }} 
    >  
      Add Task
    
    </Button>

   {todos?.map(todo => 


      <Flex key={todo.id} direction="column" border="1px solid black" padding={8} >
         <Text fontWeight={'bold'}>{todo.content}</Text> 
         <Flex >       
         <input
              type="checkbox"
              checked={todo.isDone === "true"} 
              onChange={async (e) => {
                let { __typename, ...updatedTodo } = todo;
                 updatedTodo = {
                  ...updatedTodo,
                  updatedAt: (new Date()).toISOString().split('T')[0], 
                  isDone: e.target.checked ? "true" : "false" 
                };
                await API.graphql<GraphQLQuery<UpdateTodoMutation>>(graphqlOperation(updateTodo, {
                  input: updatedTodo
                })).catch((e:any)=>{console.log("updateTodo Error: ", e)}) 
              }}
            />
           
     

        <View >👨‍👩‍👧‍👦 {todo?.owners?.map(owner => <Badge key={owner}  margin={4}>{owner}</Badge>)}</View>
         
          <Flex key={todo.id} >
            <Button onClick={async () => {
              const shareWithWhom = window.prompt('Share with whom?');
              if (!shareWithWhom) {
                setErrorMessage('Share with whom value is required');
                return;
              }

              setErrorMessage(null); 

             await API.graphql<GraphQLQuery<UpdateTodoMutation>>(graphqlOperation(updateTodo, {
                  input: {
                  id: todo.id,
                  createdAt: todo.createdAt, 
                  updatedAt: (new Date()).toISOString().split('T')[0], 
                  tenantId: todo.tenantId,
                  sub: todo.sub,
                  content: todo.content, 
                  owners: [...todo?.owners as [], shareWithWhom]
                  }
              }))
            }}>Share ➕</Button>

            {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

            <Button onClick={async () => {

              await API.graphql<GraphQLQuery<DeleteTodoMutation>>(graphqlOperation(deleteTodo, {
                  id: todo.id
                }))
              }}>Delete</Button>
          </Flex>
               
        </Flex>
          
      </Flex> 
    
      )}
     
    </Flex>
  );

};

export default TaskShare;
